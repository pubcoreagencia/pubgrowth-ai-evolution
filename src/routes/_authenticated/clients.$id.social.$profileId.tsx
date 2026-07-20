import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Line,
  LineChart as ReLine,
  Bar,
  BarChart as ReBar,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { getSocialProfileFn, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social-profiles.functions";
import {
  listMetricsByProfileFn,
  upsertMetricFn,
  deleteMetricFn,
  type SocialMetric,
} from "@/lib/social-metrics.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, PlusCircle, Trash2, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$id/social/$profileId")({
  component: ProfileEvolutionPage,
  head: () => ({ meta: [{ title: "Evolução do perfil — PubGrowth AI" }] }),
});

const platformLabel = (p: SocialPlatform) =>
  SOCIAL_PLATFORMS.find((x) => x.value === p)?.label ?? p;

type Period = "7" | "30" | "90" | "all";

function ProfileEvolutionPage() {
  const { id, profileId } = Route.useParams();
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["social-profile", profileId],
    queryFn: () => getSocialProfileFn({ data: { id: profileId } }),
  });
  const { data: metrics = [] } = useQuery({
    queryKey: ["social-metrics", profileId],
    queryFn: () => listMetricsByProfileFn({ data: { profileId } }),
    initialData: [] as SocialMetric[],
  });

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<Period>("30");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["social-metrics", profileId] });
    qc.invalidateQueries({ queryKey: ["social-profile", profileId] });
    qc.invalidateQueries({ queryKey: ["social-profiles", id] });
  };

  const { current, previous, filtered } = useMemo(
    () => splitByPeriod(metrics, period),
    [metrics, period],
  );

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await upsertMetricFn({
        data: {
          socialProfileId: profileId,
          recordedAt: String(fd.get("recordedAt") ?? ""),
          followers: Number(fd.get("followers") ?? 0) || 0,
          reach: Number(fd.get("reach") ?? 0) || 0,
          impressions: Number(fd.get("impressions") ?? 0) || 0,
          likes: Number(fd.get("likes") ?? 0) || 0,
          comments: Number(fd.get("comments") ?? 0) || 0,
          shares: Number(fd.get("shares") ?? 0) || 0,
          views: Number(fd.get("views") ?? 0) || 0,
          engagementRate: Number(fd.get("engagementRate") ?? 0) || 0,
          notes: String(fd.get("notes") ?? "").trim() || null,
        },
      });
      toast.success("Métrica registrada");
      setOpen(false);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (mid: string) => {
    if (!confirm("Remover este registro?")) return;
    try {
      await deleteMetricFn({ data: { id: mid } });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <Link
        to="/clients/$id"
        params={{ id }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para o cliente
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profile?.avatarUrl ?? undefined} />
            <AvatarFallback>
              {profile?.username.slice(0, 2).toUpperCase() ?? "??"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {profile?.profileName ?? "Perfil"}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>@{profile?.username}</span>
              {profile && (
                <Badge variant="secondary">{platformLabel(profile.platform)}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" /> Registrar métrica
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova métrica</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field name="recordedAt" label="Data*" type="date" defaultValue={today} required />
                  <Field name="followers" label="Seguidores" type="number" defaultValue={0} />
                  <Field name="reach" label="Alcance" type="number" defaultValue={0} />
                  <Field name="impressions" label="Impressões" type="number" defaultValue={0} />
                  <Field name="likes" label="Curtidas" type="number" defaultValue={0} />
                  <Field name="comments" label="Comentários" type="number" defaultValue={0} />
                  <Field name="shares" label="Compartilhamentos" type="number" defaultValue={0} />
                  <Field name="views" label="Visualizações" type="number" defaultValue={0} />
                  <Field
                    name="engagementRate"
                    label="Engajamento (%)"
                    type="number"
                    step="0.01"
                    defaultValue={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Observações</Label>
                  <Input id="notes" name="notes" placeholder="Ex.: campanha impulsionada" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    Salvar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <ComparisonCard label="Seguidores" a={current.followers} b={previous.followers} />
        <ComparisonCard label="Alcance" a={current.reach} b={previous.reach} />
        <ComparisonCard label="Impressões" a={current.impressions} b={previous.impressions} />
        <ComparisonCard
          label="Engajamento (méd. %)"
          a={current.engagementRate}
          b={previous.engagementRate}
          decimals={2}
        />
      </section>

      {filtered.length < 2 ? (
        <Card className="mt-8">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Registre pelo menos 2 métricas para visualizar a evolução.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Seguidores ao longo do tempo">
            <ResponsiveContainer width="100%" height={260}>
              <ReLine data={filtered}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="recordedAt" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="followers" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </ReLine>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Alcance vs Impressões">
            <ResponsiveContainer width="100%" height={260}>
              <ReLine data={filtered}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="recordedAt" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="reach" name="Alcance" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="impressions" name="Impressões" stroke="#6366f1" strokeWidth={2} dot={false} />
              </ReLine>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Engajamento">
            <ResponsiveContainer width="100%" height={260}>
              <ReBar data={filtered}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="recordedAt" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="likes" stackId="a" name="Curtidas" fill="#ec4899" />
                <Bar dataKey="comments" stackId="a" name="Comentários" fill="#8b5cf6" />
                <Bar dataKey="shares" stackId="a" name="Compart." fill="#f59e0b" />
              </ReBar>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Visualizações">
            <ResponsiveContainer width="100%" height={260}>
              <ReLine data={filtered}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="recordedAt" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="views" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </ReLine>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-medium">Histórico</h2>
        {metrics.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <div className="mt-3 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Seguidores</TableHead>
                  <TableHead className="text-right">Alcance</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Engaj. %</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...metrics].reverse().map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.recordedAt}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.followers.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.reach.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.impressions.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.engagementRate.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.notes ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(m.id)}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  name,
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...rest} />
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ComparisonCard({
  label,
  a,
  b,
  decimals = 0,
}: {
  label: string;
  a: number;
  b: number;
  decimals?: number;
}) {
  const delta = a - b;
  const pct = b === 0 ? (a === 0 ? 0 : 100) : (delta / b) * 100;
  const up = delta >= 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">
          {a.toLocaleString("pt-BR", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}
        </div>
        <div
          className={`mt-1 inline-flex items-center gap-1 text-xs ${up ? "text-emerald-600" : "text-red-600"}`}
        >
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {pct.toFixed(1)}% vs período anterior
        </div>
      </CardContent>
    </Card>
  );
}

function splitByPeriod(metrics: SocialMetric[], period: Period) {
  const sorted = [...metrics].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  if (period === "all") {
    return {
      filtered: sorted,
      current: aggregate(sorted),
      previous: aggregate([]),
    };
  }
  const days = Number(period);
  const now = new Date();
  const startCurrent = new Date(now);
  startCurrent.setDate(startCurrent.getDate() - days);
  const startPrev = new Date(startCurrent);
  startPrev.setDate(startPrev.getDate() - days);

  const cur = sorted.filter((m) => new Date(m.recordedAt) >= startCurrent);
  const prev = sorted.filter(
    (m) => new Date(m.recordedAt) >= startPrev && new Date(m.recordedAt) < startCurrent,
  );
  return { filtered: cur, current: aggregate(cur), previous: aggregate(prev) };
}

function aggregate(list: SocialMetric[]) {
  if (list.length === 0) {
    return { followers: 0, reach: 0, impressions: 0, engagementRate: 0 };
  }
  const last = list[list.length - 1];
  const reach = list.reduce((s, m) => s + m.reach, 0);
  const impressions = list.reduce((s, m) => s + m.impressions, 0);
  const engagementAvg =
    list.reduce((s, m) => s + m.engagementRate, 0) / list.length;
  return {
    followers: last.followers,
    reach,
    impressions,
    engagementRate: engagementAvg,
  };
}