import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useQueryClient } from "@tanstack/react-query";
import { bulkImportCampaignsFn } from "@/lib/campaigns.functions";
import { updateEstimationSettingsFn } from "@/lib/estimation-settings.functions";
import { campaignsQueryKey } from "@/lib/campaigns-store";
import { estimationSettingsQueryKey, DEFAULT_SETTINGS } from "@/lib/estimation-settings";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const qc = useQueryClient();
  const migratedRef = useRef(false);

  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    void migrateLocalStorage(qc);
  }, [qc]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">
              <Link to="/" className="font-medium text-foreground hover:opacity-80">
                PubGrowth AI
              </Link>
              <span className="mx-2 opacity-40">/</span>
              <span>Painel</span>
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

async function migrateLocalStorage(qc: ReturnType<typeof useQueryClient>) {
  try {
    const CAMP_KEY = "pubgrowth.campaigns.v1";
    const SET_KEY = "pubgrowth.settings.v1";
    const rawC = localStorage.getItem(CAMP_KEY);
    const rawS = localStorage.getItem(SET_KEY);
    if (!rawC && !rawS) return;

    if (rawC) {
      try {
        const list = JSON.parse(rawC);
        if (Array.isArray(list) && list.length) {
          const items = list.map((c: Record<string, unknown>) => ({
            clientName: String(c.clientName ?? ""),
            campaignName: String(c.campaignName ?? ""),
            videoUrl: String(c.videoUrl ?? ""),
            startDate: String(c.startDate ?? ""),
            endDate: String(c.endDate ?? ""),
            dailyBudget: Number(c.dailyBudget ?? 0),
            days: Number(c.days ?? 0),
            objective: (c.objective as "views") ?? "views",
            avgProductValue: c.avgProductValue as number | undefined,
            avgUpsellValue: c.avgUpsellValue as number | undefined,
            avgCrossSellValue: c.avgCrossSellValue as number | undefined,
            results: (c.results as Record<string, number>) ?? {},
          }));
          await bulkImportCampaignsFn({ data: { items } });
          qc.invalidateQueries({ queryKey: campaignsQueryKey });
        }
        localStorage.removeItem(CAMP_KEY);
      } catch {
        // ignore malformed data
      }
    }

    if (rawS) {
      try {
        const parsed = JSON.parse(rawS) as Record<string, number>;
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        await updateEstimationSettingsFn({ data: merged });
        qc.invalidateQueries({ queryKey: estimationSettingsQueryKey });
        localStorage.removeItem(SET_KEY);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore migration failure
  }
}