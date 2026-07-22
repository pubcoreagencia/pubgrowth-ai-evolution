import { createFileRoute, Link } from "@tanstack/react-router";
import { useCampaign } from "@/lib/campaigns-store";
import { useEstimationSettings } from "@/lib/estimation-settings";
import { useQueryClient } from "@tanstack/react-query";
import {
  fundCampaignFn,
  refundCampaignFn,
  activateCampaignFn,
  completeCampaignFn,
} from "@/lib/wallet.functions";
import { toast } from "sonner";
import { Badge as BadgeUI } from "@/components/ui/badge";
import {
  buildExecutiveReport,
  buildFunnel,
  estimateCampaign,
  formatBRL,
  formatInt,
  formatNumber,
  formatPct,
  getInstagramEmbedId,
  type FunnelStep,
} from "@/lib/campaign-estimates";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";
import {
  ArrowLeft,
  DollarSign,
  Eye,
  ExternalLink,
  Info,
  MousePointerClick,
  Printer,
  Repeat,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { type ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/campaigns/$id")({
  component: CampaignDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Campanha não encontrada</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A campanha pode ter sido removida.
      </p>
      <Button asChild className="mt-6">
        <Link to="/campaigns">Ver campanhas</Link>
      </Button>
    </div>
  ),
});

const objectiveLabels: Record<string, string> = {
  views: "Views",
  engagement: "Engajamento",
  traffic: "Tráfego",
  conversion: "Conversão",
  sales: "Vendas",
  awareness: "Reconhecimento",
};

const phaseMeta: Record<
  FunnelStep["phase"],
  { label: string; color: string; description: string; actions: string[] }
> = {
  topo: {
    label: "Topo do funil · Awareness",
    color: "var(--color-chart-1)",
    description:
      "Objetivo: maximizar alcance e reconhecimento da marca junto a públicos amplos.",
    actions: [
      "Distribuir o vídeo para públicos amplos e diversificados.",
      "Trabalhar a repetição controlada do criativo.",
      "Construir a audiência de remarketing para as próximas fases.",
    ],
  },
  meio: {
    label: "Meio do funil · Consideração",
    color: "var(--color-chart-4)",
    description:
      "Objetivo: gerar interesse e nutrir quem já assistiu ao vídeo.",
    actions: [
      "Exibir novamente o vídeo para quem já assistiu (remarketing).",
      "Apresentar novos criativos que aprofundem o valor da oferta.",
      "Inserir CTAs claros para aumentar o interesse e o clique.",
    ],
  },
  fundo: {
    label: "Fundo do funil · Conversão",
    color: "var(--color-chart-2)",
    description:
      "Objetivo: transformar o interesse acumulado em compra concreta.",
    actions: [
      "Direcionar o público quente para a página da oferta.",
      "Reforçar benefícios, provas sociais e diferenciais.",
      "Aplicar gatilhos de urgência e recuperar abandonos de checkout.",
    ],
  },
  pos: {
    label: "Pós-venda · Retenção",
    color: "var(--color-chart-3)",
    description:
      "Objetivo: aumentar o valor do cliente com upsell, cross sell e recompra.",
    actions: [
      "Oferecer upsell logo após a compra principal.",
      "Apresentar cross sell complementar em sequência.",
      "Incentivar recompra e fidelização com comunicação recorrente.",
    ],
  },
};

function CampaignDetail() {
  const { id } = Route.useParams();
  const c = useCampaign(id);
  const settings = useEstimationSettings();

  if (!c) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Campanha não encontrada</h1>
        <Button asChild className="mt-6">
          <Link to="/campaigns">Voltar</Link>
        </Button>
      </div>
    );
  }

  const e = estimateCampaign(c, settings);
  const funnel = buildFunnel(e, settings);
  const embedId = getInstagramEmbedId(c.videoUrl);
  const report = buildExecutiveReport(c, e);

  const trend = (() => {
    const days = Math.max(1, c.days);
    const data: Array<{ day: string; investimento: number; views: number; cliques: number }> = [];
    const dInvest = e.investment / days;
    const dViews = e.views / days;
    const dClicks = e.clicks / days;
    for (let i = 1; i <= days; i++) {
      data.push({
        day: `D${i}`,
        investimento: Math.round(dInvest * i),
        views: Math.round(dViews * i),
        cliques: Math.round(dClicks * i),
      });
    }
    return data;
  })();

  const engagementBreakdown = [
    { name: "Curtidas", value: Math.round(e.likes) },
    { name: "Comentários", value: Math.round(e.comments) },
    { name: "Compart.", value: Math.round(e.shares) },
    { name: "Salvamentos", value: Math.round(e.saves) },
  ];

  const phases: FunnelStep["phase"][] = ["topo", "meio", "fundo", "pos"];
  const funnelByPhase = phases.map((p) => ({
    phase: p,
    steps: funnel.filter((s) => s.phase === p),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      {/* Header */}
      <div className="no-print">
        <Link
          to="/campaigns"
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campanhas
        </Link>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary">
              {objectiveLabels[c.objective]}
            </Badge>
            <Badge variant="outline" className="border-warning/50 text-[color:var(--color-warning)]">
              Impressões estimadas
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(c.startDate)} – {formatDate(c.endDate)} · {c.days} dia
              {c.days === 1 ? "" : "s"}
            </span>
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {c.campaignName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cliente: <span className="text-foreground">{c.clientName}</span>
          </p>
        </div>
        <div className="no-print flex shrink-0 items-center gap-2">
          <Button variant="outline" asChild>
            <a href={c.videoUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Ver vídeo
            </a>
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-5 flex items-start gap-2 rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Apenas as <strong className="text-foreground">impressões</strong> são
          projetadas ({formatInt(e.views)} views ÷{" "}
          {formatPct(settings.viewsShareOfImpressions * 100, 0)}). Todos os demais
          indicadores refletem os valores reais informados no cadastro da campanha.
        </span>
      </div>

      <FinancialControls campaign={c} />

      {/* Main metric cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Investimento"
          value={formatBRL(e.investment)}
          hint={`${formatBRL(c.dailyBudget)} / dia`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Views"
          value={formatInt(e.views)}
          hint={e.cpv !== null ? `CPV ${formatBRL(e.cpv)}` : "Informado"}
          icon={<Eye className="h-4 w-4" />}
          accent="primary"
        />
        <StatCard
          label="Impressões (estimada)"
          value={formatInt(e.impressions)}
          hint={`Views ÷ ${formatPct(settings.viewsShareOfImpressions * 100, 0)}`}
          icon={<Zap className="h-4 w-4" />}
          accent="warning"
        />
        <StatCard
          label="Interações"
          value={formatInt(e.totalEngagements)}
          hint={`Engajamento ${formatPct(e.engagementRate)}`}
          icon={<Users className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label="Cliques"
          value={formatInt(e.clicks)}
          hint={`CTR ${formatPct(e.ctr)}${e.cpc !== null ? ` · CPC ${formatBRL(e.cpc)}` : ""}`}
          icon={<MousePointerClick className="h-4 w-4" />}
        />
        <StatCard
          label="Compras"
          value={formatInt(e.purchases)}
          hint={`${formatPct(e.conversionRate)} dos cliques${e.cpa !== null ? ` · CPA ${formatBRL(e.cpa)}` : ""}`}
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <StatCard
          label="Upsell / Cross sell"
          value={`${formatInt(e.upsells)} / ${formatInt(e.crossSells)}`}
          hint={`${formatBRL(e.revenueUpsell + e.revenueCrossSell)} adicionais`}
          icon={<Repeat className="h-4 w-4" />}
          accent="primary"
        />
        <StatCard
          label="Receita"
          value={formatBRL(e.revenueTotal)}
          hint={e.productValue > 0 || e.revenueManual ? (e.revenueManual ? "Informada" : `Ticket ${formatBRL(e.productValue)}`) : "Informe ticket ou receita"}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label="ROAS"
          value={e.roas !== null ? formatNumber(e.roas) : "—"}
          hint={
            e.roas === null
              ? "Sem receita informada"
              : e.roas >= 3
                ? "Excelente"
                : e.roas >= 1.5
                  ? "Bom — otimizar"
                  : "Requer ajustes"
          }
          icon={<Target className="h-4 w-4" />}
          accent={e.roas !== null && e.roas >= 2 ? "success" : "warning"}
        />
      </div>


      {/* Video preview + engagement */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="surface-card overflow-hidden p-0">
          <div className="border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Publicação
          </div>
          {embedId ? (
            <div className="relative aspect-[9/12] bg-black">
              <iframe
                src={`https://www.instagram.com/p/${embedId}/embed`}
                className="absolute inset-0 h-full w-full"
                allowTransparency
                frameBorder={0}
                scrolling="no"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex aspect-[9/12] flex-col items-center justify-center gap-2 bg-[image:var(--gradient-surface)] p-6 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <ExternalLink className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">Preview indisponível</div>
              <a
                href={c.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-xs text-primary hover:underline"
              >
                {c.videoUrl}
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-rows-[auto_1fr] gap-4">
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Engajamento estimado</h2>
              <Badge variant="outline" className="border-primary/40 text-primary">
                Taxa {formatPct(e.engagementRate)}
              </Badge>
            </div>
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementBreakdown} margin={{ left: 0, right: 8 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <RTooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {engagementBreakdown.map((_, i) => (
                      <Cell key={i} fill={`var(--color-chart-${(i % 5) + 1})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {formatInt(e.totalEngagements)} interações no total sobre {formatInt(e.views)} views informadas.
            </div>
          </div>

          <div className="surface-card p-5">
            <h2 className="text-sm font-semibold">Evolução projetada</h2>
            <p className="text-[11px] text-muted-foreground">
              Acúmulo diário aproximado ao longo dos {c.days} dia
              {c.days === 1 ? "" : "s"} de veiculação.
            </p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="investimento" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="views" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cliques" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <LegendDot color="var(--color-chart-1)" label="Investimento" />
              <LegendDot color="var(--color-chart-2)" label="Views" />
              <LegendDot color="var(--color-chart-3)" label="Cliques" />
            </div>
          </div>
        </div>
      </div>

      {/* Intelligent Funnel */}
      <div className="surface-card mt-6 p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Funil inteligente da campanha</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Jornada completa do usuário — do primeiro impacto à fidelização.
          Cada etapa mostra a quantidade estimada, a conversão para a próxima
          etapa e a perda entre etapas.
        </p>

        <div className="mt-6 space-y-8">
          {funnelByPhase.map((group) => {
            const meta = phaseMeta[group.phase];
            return (
              <div key={group.phase}>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2.5 py-1 text-xs font-medium"
                    style={{ color: meta.color }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {meta.description}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.steps.map((step, i) => {
                    const idxInFunnel = funnel.findIndex((f) => f.key === step.key);
                    const prev = idxInFunnel > 0 ? funnel[idxInFunnel - 1] : null;
                    const conv =
                      prev && prev.value > 0 ? (step.value / prev.value) * 100 : null;
                    const drop = conv !== null ? 100 - conv : null;
                    const max = funnel[0]?.value || 1;
                    const width = Math.max(3, (step.value / max) * 100);
                    return (
                      <FunnelRow
                        key={step.key}
                        color={meta.color}
                        step={step}
                        width={width}
                        conv={conv}
                        drop={drop}
                        isFirstInPhase={i === 0}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strategy Assistant */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {phases.map((p) => {
          const meta = phaseMeta[p];
          return (
            <div key={p} className="surface-card p-5">
              <div
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: meta.color }}
              >
                {meta.label}
              </div>
              <p className="mt-1 text-sm text-foreground/90">
                {meta.description}
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {meta.actions.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span
                      className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Executive report */}
      <div className="surface-card mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-[image:var(--gradient-primary)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Relatório executivo
          </h2>
        </div>
        <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
          {report.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function FunnelRow({
  color,
  step,
  width,
  conv,
  drop,
  isFirstInPhase,
}: {
  color: string;
  step: FunnelStep;
  width: number;
  conv: number | null;
  drop: number | null;
  isFirstInPhase: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-52 shrink-0 truncate text-xs text-muted-foreground">
        {step.name}
      </div>
      <div className="relative h-9 flex-1 overflow-hidden rounded-lg border border-border/60 bg-card/40">
        <div
          className="absolute inset-y-0 left-0 rounded-lg transition-all"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}, ${color}90)`,
            opacity: 0.9,
          }}
        />
        <div className="relative flex h-full items-center justify-between gap-3 px-3 text-xs font-medium">
          <span className="tabular-nums">{formatInt(step.value)}</span>
          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {step.cumulativeRevenue !== undefined && (
              <span className="text-[color:var(--color-success)]">
                {formatBRL(step.cumulativeRevenue)}
              </span>
            )}
            {conv !== null && !isFirstInPhase ? (
              <>
                <span>conv. {formatPct(conv, 1)}</span>
                {drop !== null && drop > 0 && (
                  <span className="text-destructive/80">
                    −{formatPct(drop, 1)}
                  </span>
                )}
              </>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function formatDate(iso: string): ReactNode {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const statusMeta: Record<
  string,
  { label: string; className: string }
> = {
  draft: { label: "Rascunho", className: "border-muted-foreground/40 text-muted-foreground" },
  pending_payment: { label: "Aguardando financiamento", className: "border-amber-500/50 text-amber-600 dark:text-amber-400" },
  funded: { label: "Financiada", className: "border-blue-500/50 text-blue-600 dark:text-blue-400" },
  active: { label: "Ativa", className: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" },
  running: { label: "Em veiculação", className: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" },
  completed: { label: "Concluída", className: "border-primary/40 text-primary" },
  cancelled: { label: "Cancelada", className: "border-red-500/50 text-red-600 dark:text-red-400" },
  refunded: { label: "Estornada", className: "border-red-500/50 text-red-600 dark:text-red-400" },
};

function FinancialControls({
  campaign,
}: {
  campaign: import("@/lib/campaigns-types").Campaign;
}) {
  const qc = useQueryClient();
  const meta = statusMeta[campaign.status] ?? statusMeta.draft;
  const budget = campaign.budget ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["campaigns"] });
    if (campaign.clientId) {
      qc.invalidateQueries({ queryKey: ["wallet", campaign.clientId] });
      qc.invalidateQueries({ queryKey: ["wallet-ledger", campaign.clientId] });
    }
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const canFund =
    (campaign.status === "draft" || campaign.status === "pending_payment") && budget > 0;
  const canActivate = campaign.status === "funded";
  const canComplete = campaign.status === "active" || campaign.status === "funded";
  const canRefund = campaign.status === "funded" || campaign.status === "active";

  return (
    <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <BadgeUI variant="outline" className={meta.className}>
          {meta.label}
        </BadgeUI>
        <span className="text-muted-foreground">
          Budget total:{" "}
          <span className="font-medium text-foreground">
            {budget > 0 ? formatBRL(budget) : "—"}
          </span>
        </span>
        {campaign.clientId ? (
          <Link
            to="/clients/$id/wallet"
            params={{ id: campaign.clientId }}
            className="text-primary hover:underline"
          >
            Ver carteira do cliente
          </Link>
        ) : (
          <span className="text-amber-600 dark:text-amber-400">
            Vincule um cliente para habilitar carteira
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {canFund && campaign.clientId && (
          <Button
            size="sm"
            onClick={() =>
              run("Campanha financiada", () =>
                fundCampaignFn({ data: { campaignId: campaign.id } }),
              )
            }
          >
            Financiar ({formatBRL(budget)})
          </Button>
        )}
        {canActivate && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              run("Campanha ativada", () =>
                activateCampaignFn({ data: { campaignId: campaign.id } }),
              )
            }
          >
            Ativar
          </Button>
        )}
        {canComplete && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              run("Campanha concluída", () =>
                completeCampaignFn({ data: { campaignId: campaign.id } }),
              )
            }
          >
            Concluir
          </Button>
        )}
        {canRefund && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!confirm("Estornar a verba desta campanha para a carteira?")) return;
              run("Verba estornada", () =>
                refundCampaignFn({ data: { campaignId: campaign.id, cancel: false } }),
              );
            }}
          >
            Estornar
          </Button>
        )}
      </div>
    </div>
  );
}
