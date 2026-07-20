import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyPortalDataFn, type MyPortalData } from "@/lib/client-portal.functions";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BarChart3,
  Wallet as WalletIcon,
  TrendingUp,
  Activity,
  ExternalLink,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/client-portal/")({
  component: ClientPortalPage,
  head: () => ({
    meta: [{ title: "Portal do cliente — PubGrowth AI" }],
  }),
});

const platformLabel: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
};

const platformColor: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  tiktok: "bg-neutral-900/10 text-neutral-900 dark:text-neutral-100",
  youtube: "bg-red-500/10 text-red-600 dark:text-red-400",
  facebook: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const statusMeta: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "border-muted-foreground/40 text-muted-foreground" },
  pending_payment: { label: "Aguardando", className: "border-amber-500/50 text-amber-600 dark:text-amber-400" },
  funded: { label: "Financiada", className: "border-blue-500/50 text-blue-600 dark:text-blue-400" },
  active: { label: "Ativa", className: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" },
  running: { label: "Em veiculação", className: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" },
  completed: { label: "Concluída", className: "border-primary/40 text-primary" },
  cancelled: { label: "Cancelada", className: "border-red-500/50 text-red-600 dark:text-red-400" },
  refunded: { label: "Estornada", className: "border-red-500/50 text-red-600 dark:text-red-400" },
};

const entryTypeMeta: Record<string, { label: string; className: string }> = {
  credit: { label: "Crédito", className: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" },
  debit: { label: "Débito", className: "border-blue-500/50 text-blue-600 dark:text-blue-400" },
  refund: { label: "Estorno", className: "border-amber-500/50 text-amber-600 dark:text-amber-400" },
  adjustment: { label: "Ajuste", className: "border-muted-foreground/40 text-muted-foreground" },
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const int = (v: number) => v.toLocaleString("pt-BR");

function ClientPortalPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-portal"],
    queryFn: () => getMyPortalDataFn(),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        Carregando seus dados…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Acesso indisponível</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "Não foi possível carregar seus dados. Entre em contato com a agência."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCampaigns = data.campaigns.filter(
    (c) => c.status === "active" || c.status === "running" || c.status === "funded",
  );
  const invested = data.ledger
    .filter((e) => e.entryType === "debit")
    .reduce((s, e) => s + e.amount, 0);

  const followersDelta = computeFollowersDelta(data);

  const lastUpdated = new Date(data.lastUpdatedAt);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Cliente
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            {data.client.name}
          </h1>
          {data.client.company || data.client.segment ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {data.client.company ?? ""}
              {data.client.segment ? ` · ${data.client.segment}` : ""}
            </p>
          ) : null}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Última atualização
          <div className="text-sm font-medium text-foreground">
            {lastUpdated.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Campanhas ativas"
          value={int(activeCampaigns.length)}
          icon={<Activity className="h-4 w-4" />}
          hint={`${data.campaigns.length} no total`}
        />
        <StatCard
          label="Investido"
          value={brl(invested)}
          icon={<BarChart3 className="h-4 w-4" />}
          hint="Verba consumida"
        />
        <StatCard
          label="Saldo disponível"
          value={data.wallet ? brl(data.wallet.balance) : "—"}
          icon={<WalletIcon className="h-4 w-4" />}
          hint={data.wallet ? "Em carteira" : "Sem carteira"}
        />
        <StatCard
          label="Crescimento (90d)"
          value={followersDelta.pct === null ? "—" : `${followersDelta.pct >= 0 ? "+" : ""}${followersDelta.pct.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          hint={
            followersDelta.abs === null
              ? "Sem histórico"
              : `${followersDelta.abs >= 0 ? "+" : ""}${int(followersDelta.abs)} seguidores`
          }
        />
      </div>

      {/* Campaigns */}
      <section className="mt-8">
        <SectionTitle>Campanhas</SectionTitle>
        {data.campaigns.length === 0 ? (
          <EmptyCard message="Nenhuma campanha cadastrada até o momento." />
        ) : (
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Nome</th>
                    <th className="px-4 py-3 text-left font-medium">Objetivo</th>
                    <th className="px-4 py-3 text-left font-medium">Período</th>
                    <th className="px-4 py-3 text-right font-medium">Budget</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.campaigns.map((c) => {
                    const st = statusMeta[c.status] ?? statusMeta.draft;
                    return (
                      <tr key={c.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{c.campaignName}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {c.objective}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatRange(c.startDate, c.endDate)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {c.budget > 0 ? brl(c.budget) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={st.className}>
                            {st.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {c.videoUrl ? (
                            <a
                              href={c.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              vídeo <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Social profiles */}
      <section className="mt-8">
        <SectionTitle>Redes sociais</SectionTitle>
        {data.socialProfiles.length === 0 ? (
          <EmptyCard message="Nenhum perfil social vinculado ainda." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
            {data.socialProfiles.map((p) => {
              const series = data.metrics
                .filter((m) => m.profileId === p.id)
                .map((m) => ({ t: m.recordedAt, v: m.followers }));
              const first = series[0]?.v ?? p.currentFollowers;
              const last = series[series.length - 1]?.v ?? p.currentFollowers;
              const growth = first > 0 ? ((last - first) / first) * 100 : null;
              return (
                <Card key={p.id} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {p.profileName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="truncate text-sm">
                          {p.profileName}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className={platformColor[p.platform] ?? ""}
                        >
                          {platformLabel[p.platform] ?? p.platform}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        @{p.username}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        {int(p.currentFollowers)}
                      </div>
                      <div
                        className={
                          growth === null
                            ? "text-[11px] text-muted-foreground"
                            : growth >= 0
                              ? "text-[11px] text-emerald-500"
                              : "text-[11px] text-red-500"
                        }
                      >
                        {growth === null
                          ? "—"
                          : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% (90d)`}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="h-24">
                      {series.length >= 2 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={series}>
                            <XAxis dataKey="t" hide />
                            <YAxis hide domain={["dataMin", "dataMax"]} />
                            <Tooltip
                              contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                fontSize: 12,
                              }}
                              labelFormatter={(v) =>
                                new Date(v as string).toLocaleDateString("pt-BR")
                              }
                              formatter={(v: number) => [int(v), "Seguidores"]}
                            />
                            <Line
                              type="monotone"
                              dataKey="v"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-muted-foreground">
                          Sem histórico suficiente para gráfico.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Financial */}
      <section className="mt-8 mb-10">
        <SectionTitle>Financeiro</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Saldo disponível
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">
                {data.wallet ? brl(data.wallet.balance) : "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Verba disponível para novas campanhas
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Verba investida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{brl(invested)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Total consumido em campanhas
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Movimentações recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {data.ledger.length === 0
                ? "Nenhuma movimentação registrada."
                : `${data.ledger.length} registro(s) recentes.`}
            </CardContent>
          </Card>
        </div>

        {data.ledger.length > 0 && (
          <div className="surface-card mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Descrição</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.ledger.map((e) => {
                    const meta = entryTypeMeta[e.entryType] ?? entryTypeMeta.adjustment;
                    return (
                      <tr key={e.id}>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {new Date(e.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={meta.className}>
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {e.campaignName ?? e.note ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          {brl(e.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                          {brl(e.balanceAfter)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="h-6 w-1 rounded-full bg-[image:var(--gradient-primary)]" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h2>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

function formatRange(start: string | null, end: string | null) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  if (!start && !end) return "—";
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return start ? fmt(start) : fmt(end as string);
}

function computeFollowersDelta(data: MyPortalData): {
  abs: number | null;
  pct: number | null;
} {
  if (!data.metrics.length) return { abs: null, pct: null };
  const byProfile = new Map<string, { first: number; last: number }>();
  for (const m of data.metrics) {
    const cur = byProfile.get(m.profileId);
    if (!cur) byProfile.set(m.profileId, { first: m.followers, last: m.followers });
    else cur.last = m.followers;
  }
  let first = 0;
  let last = 0;
  byProfile.forEach((v) => {
    first += v.first;
    last += v.last;
  });
  if (first === 0) return { abs: null, pct: null };
  return { abs: last - first, pct: ((last - first) / first) * 100 };
}