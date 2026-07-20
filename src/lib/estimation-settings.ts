// Configurações mínimas: apenas o que é simulado pela plataforma.
// Neste MVP a única métrica projetada automaticamente são as impressões,
// derivadas das views. As demais taxas apoiam etapas intermediárias
// do funil que o gestor não informa manualmente.

import { useSyncExternalStore } from "react";

export interface EstimationSettings {
  viewsShareOfImpressions: number;   // 0.10 → Views ≈ 10% das impressões
  // Etapas intermediárias do funil (não são informadas manualmente):
  remarketingReachRate: number;      // 0.6 → das views recebem o vídeo novamente
  ctaViewRate: number;               // 0.4 → das views veem o CTA reforçado
  offerViewRate: number;             // 0.9 → dos cliques visualizam a oferta
  checkoutInitiationRate: number;    // 0.4 → dos cliques iniciam checkout
  recurringCustomerRate: number;     // 0.2 → dos compradores viram recorrentes
}

export const DEFAULT_SETTINGS: EstimationSettings = {
  viewsShareOfImpressions: 0.1,
  remarketingReachRate: 0.6,
  ctaViewRate: 0.4,
  offerViewRate: 0.9,
  checkoutInitiationRate: 0.4,
  recurringCustomerRate: 0.2,
};

const KEY = "pubgrowth.settings.v1";
const listeners = new Set<() => void>();

function read(): EstimationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<EstimationSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function write(s: EstimationSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
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

let cache: EstimationSettings | null = null;
function shallowEq(a: EstimationSettings, b: EstimationSettings) {
  const keys = Object.keys(a) as (keyof EstimationSettings)[];
  return keys.every((k) => a[k] === b[k]);
}

export function useEstimationSettings(): EstimationSettings {
  return useSyncExternalStore(
    subscribe,
    () => {
      const next = read();
      if (cache && shallowEq(cache, next)) return cache;
      cache = next;
      return cache;
    },
    () => DEFAULT_SETTINGS,
  );
}

export function getEstimationSettings(): EstimationSettings {
  return read();
}

export function saveEstimationSettings(s: EstimationSettings) {
  write(s);
}

export function resetEstimationSettings() {
  write(DEFAULT_SETTINGS);
}
