import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type WalletEntryType = "credit" | "debit" | "refund" | "adjustment";

export interface Wallet {
  id: string;
  clientId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  walletId: string;
  clientId: string;
  campaignId: string | null;
  entryType: WalletEntryType;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  campaignName?: string | null;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const getWalletByClientFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<Wallet | null> => {
    const { data: row, error } = await context.supabase
      .from("client_wallets")
      .select("*")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      id: row.id,
      clientId: row.client_id,
      balance: toNum(row.balance),
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

export const listLedgerByClientFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<LedgerEntry[]> => {
    const { data: rows, error } = await context.supabase
      .from("wallet_ledger")
      .select("*, campaigns(campaign_name)")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const camp = (r as { campaigns?: { campaign_name: string } | null }).campaigns;
      return {
        id: r.id,
        walletId: r.wallet_id,
        clientId: r.client_id,
        campaignId: r.campaign_id,
        entryType: r.entry_type as WalletEntryType,
        amount: toNum(r.amount),
        balanceAfter: toNum(r.balance_after),
        note: r.note,
        createdAt: r.created_at,
        campaignName: camp?.campaign_name ?? null,
      };
    });
  });

export const creditWalletFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; amount: number; note?: string }) =>
    z
      .object({
        clientId: z.string().uuid(),
        amount: z.number().positive(),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("wallet_credit", {
      _client_id: data.clientId,
      _amount: data.amount,
      _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adjustWalletFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; amount: number; note?: string }) =>
    z
      .object({
        clientId: z.string().uuid(),
        amount: z.number().refine((n) => n !== 0, "valor não pode ser zero"),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("wallet_adjust", {
      _client_id: data.clientId,
      _amount: data.amount,
      _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const fundCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campaignId: string }) =>
    z.object({ campaignId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("fund_campaign", {
      _campaign_id: data.campaignId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refundCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campaignId: string; cancel?: boolean; note?: string }) =>
    z
      .object({
        campaignId: z.string().uuid(),
        cancel: z.boolean().optional(),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("refund_campaign", {
      _campaign_id: data.campaignId,
      _cancel: data.cancel ?? false,
      _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const activateCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campaignId: string }) =>
    z.object({ campaignId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("activate_campaign", {
      _campaign_id: data.campaignId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campaignId: string }) =>
    z.object({ campaignId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("complete_campaign", {
      _campaign_id: data.campaignId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });