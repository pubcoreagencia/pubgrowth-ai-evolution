import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useCampaigns, deleteCampaign, type Campaign } from "@/lib/campaigns-store";
import { useEstimationSettings } from "@/lib/estimation-settings";
import { estimateCampaign, formatBRL, formatInt, formatNumber } from "@/lib/campaign-estimates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/campaigns/")({
  component: CampaignsList,
});

function CampaignsList() {
  const campaigns = useCampaigns();
  const settings = useEstimationSettings();
  const [q, setQ] = useState("");
  const [client, setClient] = useState<string>("all");
  const navigate = useNavigate();

  const clients = useMemo(
    () => Array.from(new Set(campaigns.map((c) => c.clientName))).sort(),
    [campaigns],
  );

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (client !== "all" && c.clientName !== client) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        c.campaignName.toLowerCase().includes(s) ||
        c.clientName.toLowerCase().includes(s)
      );
    });
  }, [campaigns, q, client]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Campanhas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico completo com métricas projetadas.
          </p>
        </div>
        <Button asChild>
          <Link to="/campaigns/new" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Nova campanha
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente ou campanha..."
            className="pl-9"
          />
        </div>
        <Select value={client} onValueChange={setClient}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card mt-6 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Investimento</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    Nenhuma campanha encontrada.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <CampaignRow
                  key={c.id}
                  c={c}
                  settings={settings}
                  onOpen={() => navigate({ to: "/campaigns/$id", params: { id: c.id } })}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function CampaignRow({
  c,
  settings,
  onOpen,
}: {
  c: Campaign;
  settings: ReturnType<typeof useEstimationSettings>;
  onOpen: () => void;
}) {
  const e = estimateCampaign(c, settings);
  const status = getStatus(c);
  return (
    <TableRow className="cursor-pointer border-border/60" onClick={onOpen}>
      <TableCell className="font-medium">{c.clientName}</TableCell>
      <TableCell>
        <div className="min-w-0">
          <div className="truncate">{c.campaignName}</div>
          <div className="text-xs text-muted-foreground">
            {c.days} dia{c.days === 1 ? "" : "s"} · {c.objective}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatBRL(e.investment)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatInt(e.views)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatInt(e.clicks)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatBRL(e.revenueTotal)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {e.roas !== null ? formatNumber(e.roas) : "—"}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            status === "Concluída"
              ? "border-[color:var(--color-success)]/40 text-[color:var(--color-success)]"
              : status === "Em andamento"
                ? "border-primary/40 text-primary"
                : "border-border text-muted-foreground"
          }
        >
          {status}
        </Badge>
      </TableCell>
      <TableCell onClick={(ev) => ev.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (confirm(`Excluir a campanha "${c.campaignName}"?`)) {
              deleteCampaign(c.id);
              toast.success("Campanha excluída");
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function getStatus(c: Campaign): "Planejada" | "Em andamento" | "Concluída" {
  const now = new Date();
  const end = new Date(c.endDate);
  const start = new Date(c.startDate);
  if (now < start) return "Planejada";
  if (now > end) return "Concluída";
  return "Em andamento";
}
