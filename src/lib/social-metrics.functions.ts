import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface SocialMetric {
  id: string;
  socialProfileId: string;
  recordedAt: string;
  followers: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagementRate: number;
  notes: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  social_profile_id: string;
  recorded_at: string;
  followers: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagement_rate: number;
  notes: string | null;
  created_at: string;
};

const toMetric = (r: Row): SocialMetric => ({
  id: r.id,
  socialProfileId: r.social_profile_id,
  recordedAt: r.recorded_at,
  followers: r.followers,
  reach: r.reach,
  impressions: r.impressions,
  likes: r.likes,
  comments: r.comments,
  shares: r.shares,
  views: r.views,
  engagementRate: Number(r.engagement_rate) || 0,
  notes: r.notes,
  createdAt: r.created_at,
});

export const listMetricsByProfileFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string }) =>
    z.object({ profileId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("social_metrics_history")
      .select("*")
      .eq("social_profile_id", data.profileId)
      .order("recorded_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows as Row[]).map(toMetric);
  });

const metricSchema = z.object({
  socialProfileId: z.string().uuid(),
  recordedAt: z.string().min(1),
  followers: z.number().int().nonnegative().default(0),
  reach: z.number().int().nonnegative().default(0),
  impressions: z.number().int().nonnegative().default(0),
  likes: z.number().int().nonnegative().default(0),
  comments: z.number().int().nonnegative().default(0),
  shares: z.number().int().nonnegative().default(0),
  views: z.number().int().nonnegative().default(0),
  engagementRate: z.number().nonnegative().max(100).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const upsertMetricFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof metricSchema>) => metricSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("social_metrics_history")
      .upsert(
        {
          user_id: context.userId,
          social_profile_id: data.socialProfileId,
          recorded_at: data.recordedAt,
          followers: data.followers,
          reach: data.reach,
          impressions: data.impressions,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          views: data.views,
          engagement_rate: data.engagementRate,
          notes: data.notes ?? null,
        },
        { onConflict: "social_profile_id,recorded_at" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toMetric(row as Row);
  });

export const deleteMetricFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("social_metrics_history")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });