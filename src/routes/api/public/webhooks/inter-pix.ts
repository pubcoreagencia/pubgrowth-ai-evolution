import { createFileRoute } from "@tanstack/react-router";

// Banco Inter PIX webhook.
// Security: Inter uses mTLS on the callback. We add an additional shared-secret
// check via URL path segment or `x-webhook-secret` header for defense-in-depth.

interface InterPixEvent {
  endToEndId?: string;
  txid: string;
  valor: string;
  horario?: string;
  infoPagador?: string;
}

interface InterWebhookPayload {
  pix?: InterPixEvent[];
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.INTER_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided =
      request.headers.get("x-webhook-secret") ??
      url.searchParams.get("secret") ??
      "";
    if (!timingSafeEqualStr(provided, secret)) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: InterWebhookPayload;
  try {
    payload = (await request.json()) as InterWebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const events = Array.isArray(payload?.pix) ? payload.pix : [];
  if (events.length === 0) return new Response("ok");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  for (const ev of events) {
    const paidAmount = Number(ev?.valor);
    if (
      !ev?.txid ||
      typeof ev.txid !== "string" ||
      !Number.isFinite(paidAmount) ||
      paidAmount <= 0
    ) {
      continue;
    }

    // Toda a lógica (localizar, bloquear, validar valor, creditar, marcar paid)
    // acontece em UMA transação dentro da função `confirm_pix_payment`.
    // O índice único parcial em wallet_ledger(payment_order_id) WHERE entry_type='credit'
    // garante que webhooks concorrentes nunca gerem crédito duplicado.
    const { data, error } = await supabaseAdmin.rpc("confirm_pix_payment", {
      p_txid: ev.txid,
      p_paid_amount: paidAmount,
      p_provider_reference: ev.endToEndId ?? undefined,
    });

    if (error) {
      // Log sanitizado (sem valores/PII): apenas o resultado da RPC.
      console.error("[inter-pix] rpc error", error.message);
      continue;
    }

    const result =
      data && typeof data === "object" && "result" in data
        ? String((data as { result: unknown }).result)
        : "unknown";

    switch (result) {
      case "credited":
      case "already_paid":
        break;
      case "amount_mismatch":
        // Pedido marcado como requires_review; retornamos 200 para evitar retries
        // inúteis. Revisão manual pelo admin.
        console.warn("[inter-pix] amount_mismatch — requires_review");
        break;
      case "not_found":
        console.warn("[inter-pix] txid desconhecido");
        break;
      case "invalid_status":
        console.warn("[inter-pix] status não pagável");
        break;
      default:
        console.warn("[inter-pix] resultado inesperado:", result);
    }
  }

  return new Response("ok");
}

export const Route = createFileRoute("/api/public/webhooks/inter-pix")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      // Inter also validates the endpoint with a HEAD/GET during registration
      GET: () => new Response("ok"),
    },
  },
});