import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getClientFn } from "@/lib/clients.functions";
import {
  getWalletByClientFn,
  listLedgerByClientFn,
  creditWalletFn,
  adjustWalletFn,
  type LedgerEntry,
} from "@/lib/wallet.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, PlusCircle, Sliders, Wallet as WalletIcon } from "lucide-react";
import { formatBRL } from "@/lib/campaign-estimates";

export const Route = createFileRoute("/_authenticated/clients/$id/wallet")({
  component: WalletPage,
  head: () => ({ meta: [{ title: "Carteira — PubGrowth AI" }] }),
});

const entryLabel: Record<LedgerEntry["entryType"], string> = {
  credit: "Crédito",
  debit: "Débito",
  refund: "Estorno",
  adjustment: "Ajuste",
};

const entryColor: Record<LedgerEntry["entryType"], string> = {
  credit: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  debit: "bg-red-500/10 text-red-600 dark:text-red-400",
  refund: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  adjustment: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function WalletPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: () => getClientFn({ data: { id } }),
  });
  const { data: wallet } = useQuery({
    queryKey: ["wallet", id],
    queryFn: () => getWalletByClientFn({ data: { clientId: id } }),
  });
  const { data: ledger = [] } = useQuery({
    queryKey: ["wallet-ledger", id],
    queryFn: () => listLedgerByClientFn({ data: { clientId: id } }),
    initialData: [] as LedgerEntry[],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wallet", id] });
    qc.invalidateQueries({ queryKey: ["wallet-ledger", id] });
  };

  const totals = ledger.reduce(
    (acc, e) => {
      if (e.entryType === "credit") acc.credited += e.amount;
      else if (e.entryType === "debit") acc.spent += -e.amount;
      else if (e.entryType === "refund") acc.refunded += e.amount;
      return acc;
    },
    { credited: 0, spent: 0, refunded: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <Link
        to="/clients/$id"
        params={{ id }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para o cliente
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <WalletIcon className="h-3.5 w-3.5" /> Carteira financeira
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            {client?.name ?? "Cliente"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de verba disponível e movimentações financeiras
          </p>
        </div>
        <div className="flex gap-2">
          <CreditDialog clientId={id} onDone={invalidate} />
          <AdjustDialog clientId={id} onDone={invalidate} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <BalanceCard label="Saldo disponível" value={wallet?.balance ?? 0} accent="primary" />
        <BalanceCard label="Total creditado" value={totals.credited} />
        <BalanceCard label="Total investido" value={totals.spent} />
        <BalanceCard label="Total estornado" value={totals.refunded} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Histórico de movimentações</h2>
        <p className="text-xs text-muted-foreground">
          Registro imutável de todas as operações financeiras da carteira.
        </p>
        {ledger.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
            Nenhuma movimentação ainda. Adicione um crédito para começar.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Descrição</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ledger.map((e) => (
                  <tr key={e.id} className="hover:bg-card/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={entryColor[e.entryType]}>
                        {entryLabel[e.entryType]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {e.campaignName ? (
                        <span>
                          <span className="text-muted-foreground">Campanha: </span>
                          {e.campaignName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{e.note ?? "—"}</span>
                      )}
                      {e.campaignName && e.note ? (
                        <div className="text-xs text-muted-foreground">{e.note}</div>
                      ) : null}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${
                        e.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {e.amount >= 0 ? "+" : ""}
                      {formatBRL(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatBRL(e.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-semibold tabular-nums ${
            accent === "primary" ? "text-gradient" : ""
          }`}
        >
          {formatBRL(value)}
        </div>
      </CardContent>
    </Card>
  );
}

function CreditDialog({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount") ?? 0);
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSaving(true);
    try {
      await creditWalletFn({
        data: {
          clientId,
          amount,
          note: String(fd.get("note") ?? "").trim() || undefined,
        },
      });
      toast.success("Crédito adicionado");
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <PlusCircle className="h-4 w-4" /> Adicionar crédito
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Creditar verba na carteira</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$)*</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Observação</Label>
            <Textarea id="note" name="note" placeholder="Ex: Aporte contratual mês 07/2026" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Confirmar crédito
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount") ?? 0);
    if (!amount || amount === 0) {
      toast.error("Informe um valor diferente de zero");
      return;
    }
    setSaving(true);
    try {
      await adjustWalletFn({
        data: {
          clientId,
          amount,
          note: String(fd.get("note") ?? "").trim() || undefined,
        },
      });
      toast.success("Ajuste registrado");
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sliders className="h-4 w-4" /> Ajuste manual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste manual de saldo</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$)*</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              placeholder="Positivo credita, negativo debita"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use valores negativos (ex: -50) para debitar. Saldo nunca fica negativo.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Motivo do ajuste*</Label>
            <Textarea id="note" name="note" required placeholder="Ex: Correção de lançamento" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Registrar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}