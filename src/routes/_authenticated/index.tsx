import { createFileRoute, Link } from "@tanstack/react-router";
import { useCampaigns } from "@/lib/campaigns-store";
import { useEstimationSettings } from "@/lib/estimation-settings";
import { estimateCampaign, formatBRL, formatInt, formatNumber } from "@/lib/campaign-estimates";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  DollarSign,
  Eye,
  MousePointerClick,
  PlusCircle,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/")({
  component: Overview,
});

function Overview() {
  const campaigns = useCampaigns();
  const settings = useEstimationSettings();

  const totals = useMemo(() => {
    const t = { investment: 0, views: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    for (const c of campaigns) {
      const e = estimateCampaign(c, settings);
      t.investment += e.investment;
      t.views += e.views;
      t.impressions += e.impressions;
      t.clicks += e.clicks;
      t.purchases += e.purchases;
      t.revenue += e.revenueTotal;
    }
    return t;
  }, [campaigns, settings]);

  const roas = totals.investment > 0 ? totals.revenue / totals.investment : null;

  const chartData = useMemo(() => {
    return [...campaigns]
      .slice()
      .reverse()
      .map((c) => {
        const e = estimateCampaign(c, settings);
        return {
          name: c.campaignName.slice(0, 14),
          investimento: Math.round(e.investment),
          receita: Math.round(e.revenueTotal),
        };
      });
  }, [campaigns, settings]);

  if (campaigns.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consolidado projetado de todas as suas campanhas do Instagram.
          </p>
        </div>
        <Button asChild>
          <Link to="/campaigns/new" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Nova campanha
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Investimento total"
          value={formatBRL(totals.investment)}
          hint={`${campaigns.length} campanha${campaigns.length === 1 ? "" : "s"}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Views informadas"
          value={formatInt(totals.views)}
          icon={<Eye className="h-4 w-4" />}
          accent="primary"
        />
        <StatCard
          label="Impressões estimadas"
          value={formatInt(totals.impressions)}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="ROAS médio"
          value={roas !== null ? formatNumber(roas) : "—"}
          hint={`Receita ${formatBRL(totals.revenue)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent={roas && roas >= 2 ? "success" : "warning"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cliques estimados"
          value={formatInt(totals.clicks)}
          icon={<MousePointerClick className="h-4 w-4" />}
        />
        <StatCard
          label="Compras estimadas"
          value={formatInt(totals.purchases)}
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <StatCard
          label="Receita projetada"
          value={formatBRL(totals.revenue)}
          icon={<DollarSign className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label="Campanhas"
          value={campaigns.length}
          icon={<BarChart3 className="h-4 w-4" />}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Investimento × Receita projetada</h2>
            <span className="text-xs text-muted-foreground">Últimas campanhas</span>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gInvest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <RTooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="investimento" stroke="var(--color-chart-1)" fill="url(#gInvest)" strokeWidth={2} />
                <Area type="monotone" dataKey="receita" stroke="var(--color-chart-2)" fill="url(#gRev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-5">
          <h2 className="text-sm font-semibold">Campanhas recentes</h2>
          <ul className="mt-3 space-y-2">
            {campaigns.slice(0, 6).map((c) => {
              const e = estimateCampaign(c, settings);
              return (
                <li key={c.id}>
                  <Link
                    to="/campaigns/$id"
                    params={{ id: c.id }}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm transition hover:border-primary/50 hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.campaignName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.clientName}
                      </div>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatBRL(e.investment)}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="surface-card relative overflow-hidden p-10 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(500px_200px_at_50%_0%,oklch(0.72_0.18_250/0.15),transparent_60%)]" />
      <div className="relative">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] glow-ring">
          <TrendingUp className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">
          Transforme campanhas em <span className="text-gradient">relatórios executivos</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Cadastre uma campanha do Instagram informando apenas os dados essenciais.
          A plataforma projeta todo o funil e gera um dashboard profissional pronto
          para apresentar ao cliente.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild size="lg">
            <Link to="/campaigns/new" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Criar primeira campanha
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/campaigns">Ver campanhas</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
