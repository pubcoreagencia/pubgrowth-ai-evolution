import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Campaign, CampaignSetup, CampaignResults, CampaignObjective } from "./campaigns-types";

type Row = {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name_legacy: string | null;
  campaign_name: string;
  video_url: string | null;
  start_date: string | null;
  end_date: string | null;
  daily_budget: string | number;
  days: number;
  objective: CampaignObjective;
  avg_product_value: string | number | null;
  avg_upsell_value: string | number | null;
  avg_cross_sell_value: string | number | null;
  results: CampaignResults | null;
  status: "draft" | "running" | "completed";
  created_at: string;
  updated_at: string;
  clients?: { name: string } | null;
};

const toNum = (v: string | number | null | undefined): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function rowToCampaign(r: Row): Campaign {
  return {
    id: r.id,
    clientName: r.clients?.name ?? r.client_name_legacy ?? "",
    campaignName: r.campaign_name,
    videoUrl: r.video_url ?? "",
    startDate: r.start_date ?? "",
    endDate: r.end_date ?? "",
    dailyBudget: toNum(r.daily_budget) ?? 0,
    days: r.days,
    objective: r.objective,
    avgProductValue: toNum(r.avg_product_value),
    avgUpsellValue: toNum(r.avg_upsell_value),
    avgCrossSellValue: toNum(r.avg_cross_sell_value),
    results: r.results ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const objective = z.enum(["views", "engagement", "traffic", "conversion", "sales", "awareness"]);

const setupSchema = z.object({
  clientName: z.string().min(1).max(120),
  campaignName: z.string().min(1).max(160),
  videoUrl: z.string().max(500).optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  dailyBudget: z.number().min(0),
  days: z.number().int().min(0),
  objective,
  avgProductValue: z.number().min(0).optional(),
  avgUpsellValue: z.number().min(0).optional(),
  avgCrossSellValue: z.number().min(0).optional(),
});

const resultsSchema = z.record(z.string(), z.number().optional()).optional();

export const listCampaignsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("campaigns")
      .select("*, clients(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Row[]).map(rowToCampaign);
  });

export const createCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { setup: CampaignSetup; results?: CampaignResults }) =>
    z.object({ setup: setupSchema, results: resultsSchema }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const s = data.setup;
    const insert = {
      user_id: context.userId,
      client_name_legacy: s.clientName,
      campaign_name: s.campaignName,
      video_url: s.videoUrl || null,
      start_date: s.startDate || null,
      end_date: s.endDate || null,
      daily_budget: s.dailyBudget,
      days: s.days,
      objective: s.objective,
      avg_product_value: s.avgProductValue ?? null,
      avg_upsell_value: s.avgUpsellValue ?? null,
      avg_cross_sell_value: s.avgCrossSellValue ?? null,
      results: data.results ?? {},
    };
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .insert(insert)
      .select("*, clients(name)")
      .single();
    if (error) throw new Error(error.message);
    return rowToCampaign(row as Row);
  });

export const updateCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Partial<CampaignSetup & { results: CampaignResults }> }) =>
    z.object({ id: z.string().uuid(), patch: z.record(z.string(), z.unknown()) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const p = data.patch as Partial<CampaignSetup> & { results?: CampaignResults };
    const patch: Record<string, unknown> = {};
    if (p.clientName !== undefined) patch.client_name_legacy = p.clientName;
    if (p.campaignName !== undefined) patch.campaign_name = p.campaignName;
    if (p.videoUrl !== undefined) patch.video_url = p.videoUrl || null;
    if (p.startDate !== undefined) patch.start_date = p.startDate || null;
    if (p.endDate !== undefined) patch.end_date = p.endDate || null;
    if (p.dailyBudget !== undefined) patch.daily_budget = p.dailyBudget;
    if (p.days !== undefined) patch.days = p.days;
    if (p.objective !== undefined) patch.objective = p.objective;
    if (p.avgProductValue !== undefined) patch.avg_product_value = p.avgProductValue ?? null;
    if (p.avgUpsellValue !== undefined) patch.avg_upsell_value = p.avgUpsellValue ?? null;
    if (p.avgCrossSellValue !== undefined) patch.avg_cross_sell_value = p.avgCrossSellValue ?? null;
    if (p.results !== undefined) {
      const { data: current } = await context.supabase
        .from("campaigns")
        .select("results")
        .eq("id", data.id)
        .single();
      patch.results = { ...((current?.results as CampaignResults) ?? {}), ...p.results };
    }
    const { data: row, error } = await context.supabase
      .from("campaigns")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.id)
      .select("*, clients(name)")
      .single();
    if (error) throw new Error(error.message);
    return rowToCampaign(row as Row);
  });

export const deleteCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkImportCampaignsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { items: Array<CampaignSetup & { results?: CampaignResults }> }) =>
    z
      .object({
        items: z.array(setupSchema.extend({ results: resultsSchema })).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    if (!data.items.length) return { inserted: 0 };
    const rows = data.items.map((s) => ({
      user_id: context.userId,
      client_name_legacy: s.clientName,
      campaign_name: s.campaignName,
      video_url: s.videoUrl || null,
      start_date: s.startDate || null,
      end_date: s.endDate || null,
      daily_budget: s.dailyBudget,
      days: s.days,
      objective: s.objective,
      avg_product_value: s.avgProductValue ?? null,
      avg_upsell_value: s.avgUpsellValue ?? null,
      avg_cross_sell_value: s.avgCrossSellValue ?? null,
      results: s.results ?? {},
    }));
    const { error, count } = await context.supabase
      .from("campaigns")
      .insert(rows, { count: "exact" });
    if (error) throw new Error(error.message);
    return { inserted: count ?? rows.length };
  });