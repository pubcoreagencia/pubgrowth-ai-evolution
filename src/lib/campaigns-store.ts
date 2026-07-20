// Client-side campaign store using localStorage + useSyncExternalStore.

import { useSyncExternalStore } from "react";

export type CampaignObjective =
  | "views"
  | "engagement"
  | "traffic"
  | "conversion"
  | "sales"
  | "awareness";

export interface CampaignSetup {
  clientName: string;
  campaignName: string;
  videoUrl: string;
  startDate: string;
  endDate: string;
  dailyBudget: number;
  days: number;
  objective: CampaignObjective;
  avgProductValue?: number;
  avgUpsellValue?: number;
  avgCrossSellValue?: number;
}

// Todos os campos abaixo são informados manualmente pelo gestor.
// Apenas "impressions" é projetada automaticamente a partir das views
// (ver src/lib/campaign-estimates.ts).
export interface CampaignResults {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  linkClicks?: number;
  purchases?: number;
  upsells?: number;
  crossSells?: number;
  revenue?: number;
}

export interface Campaign extends CampaignSetup {
  id: string;
  createdAt: string;
  updatedAt: string;
  results: CampaignResults;
}

const KEY = "pubgrowth.campaigns.v1";
const listeners = new Set<() => void>();

function read(): Campaign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Campaign[]) : [];
  } catch {
    return [];
  }
}

function write(next: Campaign[]) {
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCampaigns(): Campaign[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      const list = read();
      return cacheRef.list === null || !shallowEqual(cacheRef.list, list)
        ? (cacheRef.list = list)
        : cacheRef.list;
    },
    () => [] as Campaign[],
  );
}

const cacheRef: { list: Campaign[] | null } = { list: null };
function shallowEqual(a: Campaign[], b: Campaign[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].updatedAt !== b[i].updatedAt) return false;
  }
  return true;
}

export function useCampaign(id: string | undefined): Campaign | undefined {
  const list = useCampaigns();
  return list.find((c) => c.id === id);
}

export function createCampaign(setup: CampaignSetup, results: CampaignResults = {}): Campaign {
  const now = new Date().toISOString();
  const c: Campaign = {
    ...setup,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    results,
  };
  const list = read();
  write([c, ...list]);
  return c;
}

export function updateCampaign(id: string, patch: Partial<Omit<Campaign, "id" | "createdAt">>) {
  const list = read();
  const next = list.map((c) =>
    c.id === id
      ? {
          ...c,
          ...patch,
          results: { ...c.results, ...(patch.results ?? {}) },
          updatedAt: new Date().toISOString(),
        }
      : c,
  );
  write(next);
}

export function deleteCampaign(id: string) {
  write(read().filter((c) => c.id !== id));
}

export function getCampaign(id: string): Campaign | undefined {
  return read().find((c) => c.id === id);
}
