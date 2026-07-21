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
    if (!ev?.txid || typeof ev.txid !== "string" || !Number.isFinite(paidAmount) || paidAmount <= 0) {
      continue;
    }

    const { data: order, error: findErr } = await supabaseAdmin
      .from("payment_orders")
      .select("id, client_id, status, amount")
      .eq("pix_txid", ev.txid)
      .maybeSingle();
    if (findErr) {
      console.error("[inter-pix] find error", findErr.message);
      continue;
    }
    if (!order) {
      console.warn("[inter-pix] txid não encontrado:", ev.txid);
      // 2xx to avoid retries for txids that don't belong to this app.
      continue;
    }
    if (order.status === "paid") continue; // idempotência

    // Conditional UPDATE + row count check = atomic idempotência.
    // Concurrent webhooks: apenas UMA UPDATE afeta a linha (pending -> paid);
    // as demais retornam array vazio e não creditam.
    const orderAmount = Number(order.amount);
    if (Number.isFinite(orderAmount) && Math.abs(orderAmount - paidAmount) > 0.01) {
      console.warn(
        `[inter-pix] valor divergente para txid ${ev.txid}: pago=${paidAmount} esperado=${orderAmount}. Creditando valor da ordem.`,
      );
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("payment_orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "pending")
      .select("id");
    if (updErr) {
      console.error("[inter-pix] update error", updErr.message);
      continue;
    }
    if (!updated || updated.length === 0) {
      // Outra execução concorrente já processou este txid.
      continue;
    }

    const { error: creditErr } = await supabaseAdmin.rpc("wallet_credit", {
      _client_id: order.client_id,
      _amount: orderAmount,
      _note: "Recarga PIX carteira",
    });
    if (creditErr) {
      console.error("[inter-pix] credit error", creditErr.message);
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