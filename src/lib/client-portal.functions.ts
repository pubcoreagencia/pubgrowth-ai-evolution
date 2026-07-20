import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface MyClientSummary {
  id: string;
  name: string;
  company: string | null;
  segment: string | null;
}

export interface MyPortalCampaign {
  id: string;
  campaignName: string;
  objective: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  dailyBudget: number;
  videoUrl: string | null;
  createdAt: string;
}

export interface MyPortalSocialProfile {
  id: string;
  platform: "instagram" | "tiktok" | "youtube" | "facebook";
  profileName: string;
  username: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  currentFollowers: number;
}

export interface MyPortalMetricPoint {
  profileId: string;
  recordedAt: string;
  followers: number;
}

export interface MyPortalWallet {
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface MyPortalLedgerEntry {
  id: string;
  entryType: "credit" | "debit" | "refund" | "adjustment";
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  campaignName: string | null;
}

export interface MyPortalData {
  client: MyClientSummary;
  campaigns: MyPortalCampaign[];
  socialProfiles: MyPortalSocialProfile[];
  metrics: MyPortalMetricPoint[];
  wallet: MyPortalWallet | null;
  ledger: MyPortalLedgerEntry[];
  lastUpdatedAt: string;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Loads everything the client portal shows for the currently signed-in
 * client user. RLS scopes rows to their own client_id — the server fn
 * doesn't need admin access.
 */
export const getMyPortalDataFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPortalData> => {
    const supabase = context.supabase;

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, company, segment")
      .limit(1)
      .maybeSingle();
    if (clientErr) throw new Error(clientErr.message);
    if (!clientRow) throw new Error("Nenhum cliente vinculado a esta conta.");

    const [campaignsRes, profilesRes, walletRes, ledgerRes] = await Promise.all([
      supabase
        .from("campaigns")
        .select(
          "id, campaign_name, objective, status, start_date, end_date, budget, daily_budget, video_url, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("social_profiles")
        .select(
          "id, platform, profile_name, username, profile_url, avatar_url, current_followers, is_active",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_wallets")
        .select("balance, currency, updated_at")
        .maybeSingle(),
      supabase
        .from("wallet_ledger")
        .select("*, campaigns(campaign_name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (campaignsRes.error) throw new Error(campaignsRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (walletRes.error) throw new Error(walletRes.error.message);
    if (ledgerRes.error) throw new Error(ledgerRes.error.message);

    const profiles = (profilesRes.data ?? []) as Array<{
      id: string;
      platform: MyPortalSocialProfile["platform"];
      profile_name: string;
      username: string;
      profile_url: string | null;
      avatar_url: string | null;
      current_followers: number;
    }>;

    // Recent metrics (last 90 days) for sparklines
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const profileIds = profiles.map((p) => p.id);
    let metrics: MyPortalMetricPoint[] = [];
    if (profileIds.length) {
      const { data: mRows, error: mErr } = await supabase
        .from("social_metrics_history")
        .select("social_profile_id, recorded_at, followers")
        .in("social_profile_id", profileIds)
        .gte("recorded_at", cutoff.toISOString())
        .order("recorded_at", { ascending: true });
      if (mErr) throw new Error(mErr.message);
      metrics = (mRows ?? []).map((r) => ({
        profileId: r.social_profile_id,
        recordedAt: r.recorded_at,
        followers: r.followers ?? 0,
      }));
    }

    const wallet = walletRes.data
      ? {
          balance: toNum(walletRes.data.balance),
          currency: walletRes.data.currency,
          updatedAt: walletRes.data.updated_at,
        }
      : null;

    const ledger: MyPortalLedgerEntry[] = (ledgerRes.data ?? []).map((r) => {
      const camp = (r as { campaigns?: { campaign_name: string } | null }).campaigns;
      return {
        id: r.id,
        entryType: r.entry_type as MyPortalLedgerEntry["entryType"],
        amount: toNum(r.amount),
        balanceAfter: toNum(r.balance_after),
        note: r.note,
        createdAt: r.created_at,
        campaignName: camp?.campaign_name ?? null,
      };
    });

    const campaigns: MyPortalCampaign[] = (campaignsRes.data ?? []).map((c) => ({
      id: c.id,
      campaignName: c.campaign_name,
      objective: c.objective,
      status: c.status,
      startDate: c.start_date,
      endDate: c.end_date,
      budget: toNum(c.budget),
      dailyBudget: toNum(c.daily_budget),
      videoUrl: c.video_url,
      createdAt: c.created_at,
    }));

    const socialProfiles: MyPortalSocialProfile[] = profiles.map((p) => ({
      id: p.id,
      platform: p.platform,
      profileName: p.profile_name,
      username: p.username,
      profileUrl: p.profile_url,
      avatarUrl: p.avatar_url,
      currentFollowers: p.current_followers ?? 0,
    }));

    // Newest update timestamp across relevant tables
    const stamps: string[] = [];
    if (wallet) stamps.push(wallet.updatedAt);
    campaigns.forEach((c) => stamps.push(c.createdAt));
    metrics.forEach((m) => stamps.push(m.recordedAt));
    const lastUpdatedAt = stamps.length
      ? stamps.reduce((a, b) => (a > b ? a : b))
      : new Date().toISOString();

    return {
      client: {
        id: clientRow.id,
        name: clientRow.name,
        company: clientRow.company,
        segment: clientRow.segment,
      },
      campaigns,
      socialProfiles,
      metrics,
      wallet,
      ledger,
      lastUpdatedAt,
    };
  });

/**
 * Returns the current user's role bucket for redirect decisions.
 * Not a security boundary — RLS + `has_role()` gate every write.
 */
export const getMyRoleFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ role: "admin" | "user" | "client" }> => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = new Set((data ?? []).map((r) => r.role as string));
    if (roles.has("client")) return { role: "client" };
    if (roles.has("admin")) return { role: "admin" };
    return { role: "user" };
  });

// ---------- Admin: invite / revoke client access ----------

export const getClientUserFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(i),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ userId: string; email: string | null; createdAt: string } | null> => {
      // Only admins should see the linked user email. Non-admins get null.
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) return null;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("client_users")
        .select("user_id, created_at")
        .eq("client_id", data.clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) return null;

      const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      return {
        userId: row.user_id,
        email: userInfo?.user?.email ?? null,
        createdAt: row.created_at,
      };
    },
  );

export const inviteClientUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; email: string; redirectTo?: string }) =>
    z
      .object({
        clientId: z.string().uuid(),
        email: z.string().trim().email().max(200),
        redirectTo: z.string().url().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem convidar clientes.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ensure only one client is linked to this client_id
    const { data: existing } = await supabaseAdmin
      .from("client_users")
      .select("id")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (existing) throw new Error("Este cliente já possui um acesso vinculado.");

    // Try to find existing auth user by email
    let userId: string | null = null;
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const found = list?.users.find(
      (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );
    if (found) {
      userId = found.id;
    } else {
      const { data: invited, error: inviteErr } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
          redirectTo: data.redirectTo,
        });
      if (inviteErr) throw new Error(inviteErr.message);
      userId = invited.user?.id ?? null;
    }
    if (!userId) throw new Error("Não foi possível criar o usuário do cliente.");

    // Ensure this user isn't already linked to another client
    const { data: linked } = await supabaseAdmin
      .from("client_users")
      .select("client_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (linked && linked.client_id !== data.clientId) {
      throw new Error("Este e-mail já está vinculado a outro cliente.");
    }

    // Grant 'client' role (idempotent via unique(user_id, role))
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "client" }, { onConflict: "user_id,role" });

    // Link user to client
    await supabaseAdmin.from("client_users").upsert(
      {
        user_id: userId,
        client_id: data.clientId,
        invited_by: context.userId,
      },
      { onConflict: "user_id" },
    );

    return { ok: true };
  });

export const revokeClientUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem revogar.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("client_users")
      .select("user_id")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!row) return { ok: true };

    await supabaseAdmin.from("client_users").delete().eq("client_id", data.clientId);
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", row.user_id)
      .eq("role", "client");
    return { ok: true };
  });