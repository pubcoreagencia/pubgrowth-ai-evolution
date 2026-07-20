// Motor de cálculo — MVP 1.0.
//
// Regra do MVP: apenas as IMPRESSÕES são projetadas automaticamente
// (a partir das views e da taxa configurável). Todas as demais métricas
// vêm dos valores informados manualmente pelo gestor em CampaignResults.

import type { Campaign } from "./campaigns-store";
import type { EstimationSettings } from "./estimation-settings";

export interface CampaignEstimates {
  // Setup
  investment: number;
  views: number;

  // Único indicador simulado
  impressions: number;
  impressionsEstimated: boolean;

  // Manuais
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  interactions: number; // likes + comments + shares
  totalEngagements: number; // interactions + saves
  engagementRate: number; // %

  clicks: number;
  purchases: number;
  ctr: number; // %
  conversionRate: number; // %

  upsells: number;
  crossSells: number;

  productValue: number;
  upsellValue: number;
  crossSellValue: number;
  revenueMain: number;
  revenueUpsell: number;
  revenueCrossSell: number;
  revenueTotal: number;
  revenueManual: boolean;

  cpv: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
}

export function estimateCampaign(
  c: Campaign,
  s: EstimationSettings,
): CampaignEstimates {
  const investment = (c.dailyBudget || 0) * (c.days || 0);
  const views = c.results.views ?? 0;

  // Única métrica simulada
  const impressions =
    s.viewsShareOfImpressions > 0 ? views / s.viewsShareOfImpressions : 0;

  // Manuais
  const likes = c.results.likes ?? 0;
  const comments = c.results.comments ?? 0;
  const shares = c.results.shares ?? 0;
  const saves = c.results.saves ?? 0;
  const interactions = likes + comments + shares;
  const totalEngagements = interactions + saves;
  const engagementRate = views > 0 ? (totalEngagements / views) * 100 : 0;

  const clicks = c.results.linkClicks ?? 0;
  const purchases = c.results.purchases ?? 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const conversionRate = clicks > 0 ? (purchases / clicks) * 100 : 0;

  const upsells = c.results.upsells ?? 0;
  const crossSells = c.results.crossSells ?? 0;

  const productValue = c.avgProductValue ?? 0;
  const upsellValue = c.avgUpsellValue ?? 0;
  const crossSellValue = c.avgCrossSellValue ?? 0;

  const revenueMain = purchases * productValue;
  const revenueUpsell = upsells * upsellValue;
  const revenueCrossSell = crossSells * crossSellValue;

  const revenueManual = c.results.revenue !== undefined && c.results.revenue > 0;
  const revenueTotal = revenueManual
    ? (c.results.revenue as number)
    : revenueMain + revenueUpsell + revenueCrossSell;

  const cpv = views > 0 ? investment / views : null;
  const cpc = clicks > 0 ? investment / clicks : null;
  const cpa = purchases > 0 ? investment / purchases : null;
  const roas = investment > 0 && revenueTotal > 0 ? revenueTotal / investment : null;

  return {
    investment,
    views,
    impressions,
    impressionsEstimated: views > 0,
    likes,
    comments,
    shares,
    saves,
    interactions,
    totalEngagements,
    engagementRate,
    clicks,
    purchases,
    ctr,
    conversionRate,
    upsells,
    crossSells,
    productValue,
    upsellValue,
    crossSellValue,
    revenueMain,
    revenueUpsell,
    revenueCrossSell,
    revenueTotal,
    revenueManual,
    cpv,
    cpc,
    cpa,
    roas,
  };
}

export interface FunnelStep {
  key: string;
  name: string;
  phase: "topo" | "meio" | "fundo" | "pos";
  value: number;
  estimated: boolean;
  cumulativeRevenue?: number;
}

export function buildFunnel(
  e: CampaignEstimates,
  s: EstimationSettings,
): FunnelStep[] {
  const remarketing = e.views; // toda view entra em audiência
  const remarketingReceived = e.views * s.remarketingReachRate;
  const ctaReached = e.views * s.ctaViewRate;
  const offerViewed = e.clicks * s.offerViewRate;
  const checkoutStarted = e.clicks * s.checkoutInitiationRate;
  const recurring = e.purchases * s.recurringCustomerRate;

  return [
    { key: "start", name: "Campanha iniciada", phase: "topo", value: e.impressions, estimated: true },
    { key: "impressions", name: "Pessoas impactadas", phase: "topo", value: e.impressions, estimated: true },
    { key: "views", name: "Assistiram ao vídeo", phase: "topo", value: e.views, estimated: false },
    { key: "remarketing", name: "Entraram em remarketing", phase: "meio", value: remarketing, estimated: true },
    { key: "reimpact", name: "Receberam vídeo novamente", phase: "meio", value: remarketingReceived, estimated: true },
    { key: "cta", name: "Receberam CTA", phase: "meio", value: ctaReached, estimated: true },
    { key: "clicks", name: "Clicaram no link", phase: "fundo", value: e.clicks, estimated: false },
    { key: "offer", name: "Visualizaram a oferta", phase: "fundo", value: offerViewed, estimated: true },
    { key: "checkout", name: "Iniciaram checkout", phase: "fundo", value: checkoutStarted, estimated: true },
    { key: "purchase", name: "Compraram", phase: "fundo", value: e.purchases, estimated: false, cumulativeRevenue: e.revenueMain },
    { key: "upsell_offer", name: "Receberam oferta de Upsell", phase: "pos", value: e.purchases, estimated: false },
    { key: "upsell_buy", name: "Compraram Upsell", phase: "pos", value: e.upsells, estimated: false, cumulativeRevenue: e.revenueMain + e.revenueUpsell },
    { key: "cross_offer", name: "Receberam Cross Sell", phase: "pos", value: e.purchases, estimated: false },
    { key: "cross_buy", name: "Compraram Cross Sell", phase: "pos", value: e.crossSells, estimated: false, cumulativeRevenue: e.revenueMain + e.revenueUpsell + e.revenueCrossSell },
    { key: "recurring", name: "Clientes recorrentes", phase: "pos", value: recurring, estimated: true },
  ];
}

// Format helpers

export function formatBRL(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

export function formatPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function getInstagramEmbedId(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export function buildExecutiveReport(
  c: Campaign,
  e: CampaignEstimates,
): string[] {
  const parts: string[] = [];

  parts.push(
    `A campanha "${c.campaignName}" para ${c.clientName} foi veiculada por ${c.days} dia${c.days === 1 ? "" : "s"}, com investimento total de ${formatBRL(e.investment)} (${formatBRL(c.dailyBudget)} por dia). As ${formatInt(e.views)} visualizações informadas se traduzem em uma estimativa de ${formatInt(e.impressions)} impressões — únicos indicadores projetados; os demais números refletem os resultados reais informados.`,
  );

  if (e.totalEngagements > 0) {
    parts.push(
      `A publicação gerou ${formatInt(e.totalEngagements)} interações no total (${formatInt(e.likes)} curtidas, ${formatInt(e.comments)} comentários, ${formatInt(e.shares)} compartilhamentos e ${formatInt(e.saves)} salvamentos), resultando em uma taxa de engajamento sobre views de ${formatPct(e.engagementRate)}.`,
    );
  }

  if (e.clicks > 0 || e.purchases > 0) {
    parts.push(
      `Ao longo da jornada de conversão foram registrados ${formatInt(e.clicks)} cliques no link (CTR de ${formatPct(e.ctr)}) e ${formatInt(e.purchases)} compra${e.purchases === 1 ? "" : "s"} concretizada${e.purchases === 1 ? "" : "s"}, equivalente a uma taxa de conversão de ${formatPct(e.conversionRate)} entre clique e compra.`,
    );
  }

  if (e.revenueTotal > 0) {
    parts.push(
      `A receita total foi de ${formatBRL(e.revenueTotal)}${e.revenueMain > 0 ? `, sendo ${formatBRL(e.revenueMain)} da venda principal` : ""}${e.revenueUpsell > 0 ? `, ${formatBRL(e.revenueUpsell)} em ${formatInt(e.upsells)} upsells` : ""}${e.revenueCrossSell > 0 ? ` e ${formatBRL(e.revenueCrossSell)} em ${formatInt(e.crossSells)} cross sells` : ""}${e.roas !== null ? `. O ROAS resultante foi de ${formatNumber(e.roas)}` : ""}.`,
    );
  }

  if (e.roas !== null) {
    if (e.roas >= 3) {
      parts.push(
        `O desempenho é sólido: para cada real investido, o retorno foi de ${formatNumber(e.roas)} reais. Recomenda-se manter o criativo em veiculação e considerar escalar o investimento diário, monitorando a saturação da audiência.`,
      );
    } else if (e.roas >= 1.5) {
      parts.push(
        `O retorno é positivo, porém há margem para otimização. Sugere-se testar variações de CTA, refinar o público de remarketing e reforçar gatilhos de conversão para elevar a taxa de compra sobre cliques.`,
      );
    } else {
      parts.push(
        `O ROAS indica que o funil precisa de ajustes antes de qualquer escala. Prioridades sugeridas: revisar a oferta, encurtar o caminho até o checkout e trabalhar campanhas dedicadas de recuperação de abandono.`,
      );
    }
  }

  parts.push(
    `Recomendações para a próxima campanha: reforçar upsell e cross sell para elevar o ticket médio; nutrir a base de remarketing gerada por este vídeo com um segundo criativo focado em conversão; e acompanhar a evolução do CPA (${formatBRL(e.cpa)}) e CPV (${formatBRL(e.cpv)}) ao longo dos próximos aportes.`,
  );

  return parts;
}
