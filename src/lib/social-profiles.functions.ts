import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "facebook";

export const SOCIAL_PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
];

export interface SocialProfile {
  id: string;
  clientId: string;
  platform: SocialPlatform;
  profileName: string;
  username: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  currentFollowers: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  client_id: string;
  platform: SocialPlatform;
  profile_name: string;
  username: string;
  profile_url: string | null;
  avatar_url: string | null;
  current_followers: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const toProfile = (r: Row): SocialProfile => ({
  id: r.id,
  clientId: r.client_id,
  platform: r.platform,
  profileName: r.profile_name,
  username: r.username,
  profileUrl: r.profile_url,
  avatarUrl: r.avatar_url,
  currentFollowers: r.current_followers,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const listSocialProfilesByClientFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("social_profiles")
      .select("*")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows as Row[]).map(toProfile);
  });

export const getSocialProfileFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("social_profiles")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? toProfile(row as Row) : null;
  });

const profileSchema = z.object({
  clientId: z.string().uuid(),
  platform: z.enum(["instagram", "tiktok", "youtube", "facebook"]),
  profileName: z.string().trim().min(1).max(160),
  username: z.string().trim().min(1).max(120),
  profileUrl: z.string().trim().max(500).optional().nullable(),
  avatarUrl: z.string().trim().max(500).optional().nullable(),
  currentFollowers: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export const createSocialProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof profileSchema>) => profileSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("social_profiles")
      .insert({
        user_id: context.userId,
        client_id: data.clientId,
        platform: data.platform,
        profile_name: data.profileName,
        username: data.username,
        profile_url: data.profileUrl ?? null,
        avatar_url: data.avatarUrl ?? null,
        current_followers: data.currentFollowers ?? 0,
        is_active: data.isActive ?? true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toProfile(row as Row);
  });

const profileUpdateSchema = z.object({
  id: z.string().uuid(),
  profileName: z.string().trim().min(1).max(160).optional(),
  username: z.string().trim().min(1).max(120).optional(),
  profileUrl: z.string().trim().max(500).optional().nullable(),
  avatarUrl: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateSocialProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof profileUpdateSchema>) => profileUpdateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = {};
    if (data.profileName !== undefined) patch.profile_name = data.profileName;
    if (data.username !== undefined) patch.username = data.username;
    if (data.profileUrl !== undefined) patch.profile_url = data.profileUrl;
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    const { data: row, error } = await context.supabase
      .from("social_profiles")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toProfile(row as Row);
  });

export const deleteSocialProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("social_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });