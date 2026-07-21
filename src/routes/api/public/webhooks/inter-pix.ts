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

async function handle(request: Request): Promise<Response> {
  const secret = process.env.INTER_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided =
      request.headers.get("x-webhook-secret") ??
      url.searchParams.get("secret") ??
      "";
    if (provided !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: InterWebhookPayload;
  try {
    payload = (await request.json()) as InterWebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const events = payload.pix ?? [];
  if (events.length === 0) return new Response("ok");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  for (const ev of events) {
    const amount = Number(ev.valor);
    if (!ev.txid || !Number.isFinite(amount) || amount <= 0) continue;

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
      continue;
    }
    if (order.status === "paid") continue; // idempotência

    const { error: updErr } = await supabaseAdmin
      .from("payment_orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "pending");
    if (updErr) {
      console.error("[inter-pix] update error", updErr.message);
      continue;
    }

    const { error: creditErr } = await supabaseAdmin.rpc("wallet_credit", {
      _client_id: order.client_id,
      _amount: amount,
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