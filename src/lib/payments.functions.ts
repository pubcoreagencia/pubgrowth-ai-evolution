import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PaymentStatus = "pending" | "paid" | "expired" | "cancelled";

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
  clientName?: string | null;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

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

    const txid = ("PG" + link.client_id.replace(/-/g, "") + Date.now().toString(36))
      .slice(0, 35)
      .toUpperCase();

    const charge = await interPixProvider.createPixCharge({
      txid,
      amount: data.amount,
      description: `Recarga carteira ${client?.name ?? "cliente"}`.slice(0, 140),
    });

    const { data: inserted, error } = await supabaseAdmin
      .from("payment_orders")
      .insert({
        user_id: context.userId,
        client_id: link.client_id,
        amount: data.amount,
        status: "pending",
        pix_txid: charge.txid,
        pix_qrcode: charge.qrcodeBase64,
        pix_copy_paste: charge.copyPaste,
        external_payment_id: charge.externalId,
        expires_at: charge.expiresAt,
      })
      .select("*, clients(name)")
      .single();
    if (error) throw new Error(error.message);
    return mapRow(inserted);
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