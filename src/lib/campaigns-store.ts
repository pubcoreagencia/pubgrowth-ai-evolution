// Server-backed campaign store. Persistence goes through server functions.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCampaignsFn,
  createCampaignFn,
  updateCampaignFn,
  deleteCampaignFn,
} from "./campaigns.functions";
import type { Campaign, CampaignSetup, CampaignResults } from "./campaigns-types";

export type { Campaign, CampaignSetup, CampaignResults, CampaignObjective } from "./campaigns-types";

export const campaignsQueryKey = ["campaigns"] as const;

export function useCampaigns(): Campaign[] {
  const { data } = useQuery({
    queryKey: campaignsQueryKey,
    queryFn: () => listCampaignsFn(),
    initialData: [] as Campaign[],
    staleTime: 30_000,
  });
  return data ?? [];
}

export function useCampaign(id: string | undefined): Campaign | undefined {
  const list = useCampaigns();
  if (!id) return undefined;
  return list.find((c) => c.id === id);
}

export async function createCampaign(
  setup: CampaignSetup,
  results: CampaignResults = {},
): Promise<Campaign> {
  return createCampaignFn({ data: { setup, results } });
}

export async function updateCampaign(
  id: string,
  patch: Partial<CampaignSetup & { results: CampaignResults }>,
): Promise<Campaign> {
  return updateCampaignFn({ data: { id, patch } });
}

export async function deleteCampaign(id: string): Promise<void> {
  await deleteCampaignFn({ data: { id } });
}

export function useInvalidateCampaigns() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: campaignsQueryKey });
}
