import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";

export type PaymentStatus = "pending" | "paid" | "expired" | "cancelled" | "requires_review";

export interface PaymentOrder {
  id: string;
  clientId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  pixTxid: string | null;
  pixQrcode: string | null;
  pixCopyPaste: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  reconciliationError: string | null;
  providerResponse: Json | null;
  clientName?: string | null;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

function sanitizePaymentError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 500);
}

function mergeProviderResponse(
  current: Json | null,
  key: string,
  value: Json,
): Json {
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return { ...current, [key]: value };
  }
  return { [key]: value };
}

function randomAlphaNumeric(length: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function createPixTxid(clientId: string): string {
  const clientPart = clientId.replace(/-/g, "").slice(-8).toUpperCase();
  const timePart = Date.now().toString(36).toUpperCase().padStart(8, "0").slice(-8);
  return `PG${timePart}${clientPart}${randomAlphaNumeric(12)}`.slice(0, 35);
}

function isUniquePixTxidError(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "23505" && /payment_orders_pix_txid_key|pix_txid/i.test(error.message ?? "")
  );
}

function mapRow(r: {
  id: string;
  client_id: string;
  user_id: string;
  amount: number | string;
  status: PaymentStatus;
  pix_txid: string | null;
  pix_qrcode: string | null;
  pix_copy_paste: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  reconciliation_error: string | null;
  provider_response: Json | null;
  clients?: { name: string } | null;
}): PaymentOrder {
  return {
    id: r.id,
    clientId: r.client_id,
    userId: r.user_id,
    amount: toNum(r.amount),
    status: r.status,
    pixTxid: r.pix_txid,
    pixQrcode: r.pix_qrcode,
    pixCopyPaste: r.pix_copy_paste,
    expiresAt: r.expires_at,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    reconciliationError: r.reconciliation_error,
    providerResponse: r.provider_response,
    clientName: r.clients?.name ?? null,
  };
}

// Client creates a PIX top-up for their own wallet.
export const createMyPixOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { amount: number }) =>
    z.object({ amount: z.number().positive().max(500000) }).parse(i),
  )
  .handler(async ({ context, data }): Promise<PaymentOrder> => {
    // Resolve the caller's client_id via RLS-scoped read
    const { data: link, error: linkErr } = await context.supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (linkErr) throw new Error(linkErr.message);
    if (!link?.client_id) throw new Error("Sua conta não está vinculada a um cliente.");

    // Fetch client name for description
    const { data: client } = await context.supabase
      .from("clients")
      .select("name")
      .eq("id", link.client_id)
      .maybeSingle();

    const { interPixProvider } = await import("./payment-provider/inter-pix.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let txid = createPixTxid(link.client_id);
    let inserted: Parameters<typeof mapRow>[0] | null = null;
    let lastInsertError: { code?: string; message?: string } | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      txid = createPixTxid(link.client_id);
      const { data: row, error: insertError } = await supabaseAdmin
        .from("payment_orders")
        .insert({
          user_id: context.userId,
          client_id: link.client_id,
          amount: data.amount,
          status: "pending",
          pix_txid: txid,
        })
        .select("*, clients(name)")
        .single();

      if (!insertError) {
        inserted = row;
        break;
      }
      if (!isUniquePixTxidError(insertError)) throw new Error(insertError.message);
      lastInsertError = insertError;
    }

    if (!inserted) {
      throw new Error(lastInsertError?.message ?? "Nao foi possivel criar a cobranca PIX.");
    }

    try {
      const charge = await interPixProvider.createPixCharge({
        txid,
        amount: data.amount,
        description: `Recarga carteira ${client?.name ?? "cliente"}`.slice(0, 140),
      });

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("payment_orders")
        .update({
          pix_txid: charge.txid,
          pix_qrcode: charge.qrcodeBase64,
          pix_copy_paste: charge.copyPaste,
          external_payment_id: charge.externalId,
          expires_at: charge.expiresAt,
          provider_response: charge.providerResponse as Json,
          reconciliation_error: null,
        })
        .eq("id", inserted.id)
        .select("*, clients(name)")
        .single();
      if (updateError) throw new Error(updateError.message);
      console.info("[payments] Pix order created", {
        paymentOrderId: inserted.id,
        txid: charge.txid,
        amount: data.amount,
        status: updated.status,
        pixCopyPaste: charge.copyPaste,
        providerResponse: charge.providerResponse,
      });
      return mapRow(updated);
    } catch (error) {
      const safeMessage = sanitizePaymentError(error);
      await supabaseAdmin
        .from("payment_orders")
        .update({ reconciliation_error: safeMessage })
        .eq("id", inserted.id);
      throw new Error(safeMessage);
    }
  });

export const getPaymentOrderFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<PaymentOrder | null> => {
    const { data: row, error } = await context.supabase
      .from("payment_orders")
      .select("*, clients(name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? mapRow(row) : null;
  });

export const listMyPaymentOrdersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentOrder[]> => {
    const { data: rows, error } = await context.supabase
      .from("payment_orders")
      .select("*, clients(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapRow);
  });

export const listAllPaymentOrdersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentOrder[]> => {
    // Verify admin via has_role (RLS still gates the read).
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso negado.");
    const { data: rows, error } = await context.supabase
      .from("payment_orders")
      .select("*, clients(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapRow);
  });

export const simulateSandboxPixPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { paymentOrderId: string }) =>
    z.object({ paymentOrderId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<PaymentOrder> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso negado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("payment_orders")
      .select("*, clients(name)")
      .eq("id", data.paymentOrderId)
      .single();
    if (error) throw new Error(error.message);
    if (!order.pix_txid) throw new Error("Esta cobranca nao tem TXID.");
    if (order.status === "paid") return mapRow(order);

    const { paySandboxPixCharge } = await import("./payment-provider/inter-pix.server");
    let sandboxPayment: unknown;
    try {
      sandboxPayment = await paySandboxPixCharge({
        txid: order.pix_txid,
        amount: toNum(order.amount),
        copyPaste: order.pix_copy_paste,
      });
    } catch (error) {
      const safeMessage = sanitizePaymentError(error);
      const providerResponse =
        error instanceof Error && "providerResponse" in error
          ? ((error as Error & { providerResponse?: Json }).providerResponse ?? null)
          : null;
      await supabaseAdmin
        .from("payment_orders")
        .update({
          provider_response: mergeProviderResponse(
            order.provider_response,
            "sandboxPaymentFailure",
            (providerResponse ?? safeMessage) as Json,
          ),
          reconciliation_error: safeMessage,
        })
        .eq("id", order.id);
      throw new Error(safeMessage);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("payment_orders")
      .update({
        provider_response: mergeProviderResponse(
          order.provider_response,
          "sandboxPayment",
          sandboxPayment as Json,
        ),
        reconciliation_error: null,
      })
      .eq("id", order.id)
      .select("*, clients(name)")
      .single();
    if (updateError) throw new Error(updateError.message);

    console.info("[payments] Sandbox Pix payment simulation requested", {
      paymentOrderId: order.id,
      txid: order.pix_txid,
      amount: toNum(order.amount),
      providerResponse: sandboxPayment,
    });

    return mapRow(updated);
  });
