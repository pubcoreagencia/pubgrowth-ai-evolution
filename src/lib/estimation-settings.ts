// Server-backed estimation settings store.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_SETTINGS,
  getEstimationSettingsFn,
  updateEstimationSettingsFn,
  type EstimationSettings,
} from "./estimation-settings.functions";

export { DEFAULT_SETTINGS };
export type { EstimationSettings };

export const estimationSettingsQueryKey = ["estimation-settings"] as const;

export function useEstimationSettings(): EstimationSettings {
  const { data } = useQuery({
    queryKey: estimationSettingsQueryKey,
    queryFn: () => getEstimationSettingsFn(),
    initialData: DEFAULT_SETTINGS,
    staleTime: 60_000,
  });
  return data ?? DEFAULT_SETTINGS;
}

export async function saveEstimationSettings(s: EstimationSettings): Promise<EstimationSettings> {
  return updateEstimationSettingsFn({ data: s });
}

export async function resetEstimationSettings(): Promise<EstimationSettings> {
  return updateEstimationSettingsFn({ data: DEFAULT_SETTINGS });
}

export function useInvalidateEstimationSettings() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: estimationSettingsQueryKey });
}
