import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface EstimationSettings {
  viewsShareOfImpressions: number;
  remarketingReachRate: number;
  ctaViewRate: number;
  offerViewRate: number;
  checkoutInitiationRate: number;
  recurringCustomerRate: number;
}

export const DEFAULT_SETTINGS: EstimationSettings = {
  viewsShareOfImpressions: 0.1,
  remarketingReachRate: 0.6,
  ctaViewRate: 0.4,
  offerViewRate: 0.9,
  checkoutInitiationRate: 0.4,
  recurringCustomerRate: 0.2,
};

type Row = {
  user_id: string;
  views_share_of_impressions: string | number;
  remarketing_reach_rate: string | number;
  cta_view_rate: string | number;
  offer_view_rate: string | number;
  checkout_initiation_rate: string | number;
  recurring_customer_rate: string | number;
};

const n = (v: string | number) => (typeof v === "number" ? v : Number(v));

function rowTo(r: Row): EstimationSettings {
  return {
    viewsShareOfImpressions: n(r.views_share_of_impressions),
    remarketingReachRate: n(r.remarketing_reach_rate),
    ctaViewRate: n(r.cta_view_rate),
    offerViewRate: n(r.offer_view_rate),
    checkoutInitiationRate: n(r.checkout_initiation_rate),
    recurringCustomerRate: n(r.recurring_customer_rate),
  };
}

export const getEstimationSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("estimation_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const { data: inserted, error: e2 } = await context.supabase
        .from("estimation_settings")
        .insert({ user_id: context.userId })
        .select("*")
        .single();
      if (e2) throw new Error(e2.message);
      return rowTo(inserted as Row);
    }
    return rowTo(data as Row);
  });

const settingsSchema = z.object({
  viewsShareOfImpressions: z.number().min(0).max(1),
  remarketingReachRate: z.number().min(0).max(1),
  ctaViewRate: z.number().min(0).max(1),
  offerViewRate: z.number().min(0).max(1),
  checkoutInitiationRate: z.number().min(0).max(1),
  recurringCustomerRate: z.number().min(0).max(1),
});

export const updateEstimationSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EstimationSettings) => settingsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const patch = {
      user_id: context.userId,
      views_share_of_impressions: data.viewsShareOfImpressions,
      remarketing_reach_rate: data.remarketingReachRate,
      cta_view_rate: data.ctaViewRate,
      offer_view_rate: data.offerViewRate,
      checkout_initiation_rate: data.checkoutInitiationRate,
      recurring_customer_rate: data.recurringCustomerRate,
    };
    const { data: row, error } = await context.supabase
      .from("estimation_settings")
      .upsert(patch, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowTo(row as Row);
  });