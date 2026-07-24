import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllPaymentOrdersFn,
  simulateSandboxPixPaymentFn,
  type PaymentOrder,
} from "@/lib/payments.functions";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Clock, CheckCircle2, TrendingUp, PlayCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/financial")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AdminFinancialPage,
  head: () => ({ meta: [{ title: "Financeiro - PubGrowth AI" }] }),
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const statusLabel: Record<PaymentOrder["status"], string> = {
  pending: "Pendente",
  paid: "Pago",
  expired: "Expirado",
  cancelled: "Cancelado",
  requires_review: "Em revisão",
};

const statusVariant: Record<
  PaymentOrder["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  paid: "default",
  expired: "outline",
  cancelled: "destructive",
  requires_review: "outline",
};

function formatProviderResponse(value: PaymentOrder["providerResponse"]): string {
  if (!value) return "Sem resposta registrada.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function AdminFinancialPage() {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-payment-orders"],
    queryFn: () => listAllPaymentOrdersFn(),
  });
  const simulatePaymentMut = useMutation({
    mutationFn: (paymentOrderId: string) => simulateSandboxPixPaymentFn({ data: { paymentOrderId } }),
    onSuccess: async () => {
      toast.success("Simulação enviada ao Banco Inter. Aguarde a confirmação do webhook.");
      await queryClient.invalidateQueries({ queryKey: ["admin-payment-orders"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao simular pagamento sandbox.");
    },
  });

  const orders = q.data ?? [];
  const pending = orders.filter((o) => o.status === "pending");
  const paid = orders.filter((o) => o.status === "paid");
  const totalReceived = paid.reduce((s, o) => s + o.amount, 0);
  const now = new Date();
  const paidToday = paid.filter((o) => {
    if (!o.paidAt) return false;
    const d = new Date(o.paidAt);
    return d.toDateString() === now.toDateString();
  });

  const byClient = new Map<string, { name: string; total: number }>();
  for (const o of paid) {
    const key = o.clientId;
    const cur = byClient.get(key) ?? { name: o.clientName ?? "-", total: 0 };
    cur.total += o.amount;
    byClient.set(key, cur);
  }
  const topClients = Array.from(byClient.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Pagamentos PIX recebidos e créditos por cliente.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Pendentes"
          value={String(pending.length)}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Aprovados hoje"
          value={String(paidToday.length)}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Total recebido"
          value={brl(totalReceived)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Recebido hoje"
          value={brl(paidToday.reduce((s, o) => s + o.amount, 0))}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Todos os pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-2">Data</th>
                      <th className="pb-2">Cliente</th>
                      <th className="pb-2">Valor</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">TXID</th>
                      <th className="pb-2">Pago em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <Fragment key={o.id}>
                        <tr className="border-t">
                          <td className="py-2">
                            {new Date(o.createdAt).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-2">{o.clientName ?? "-"}</td>
                          <td className="py-2">{brl(o.amount)}</td>
                          <td className="py-2">
                            <Badge variant={statusVariant[o.status]}>
                              {statusLabel[o.status]}
                            </Badge>
                          </td>
                          <td className="max-w-48 py-2">
                            <code className="block truncate rounded bg-muted px-2 py-1 text-xs">
                              {o.pixTxid ?? "-"}
                            </code>
                          </td>
                          <td className="py-2">
                            {o.paidAt ? new Date(o.paidAt).toLocaleString("pt-BR") : "-"}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={6} className="pb-3">
                            <details className="rounded-md border bg-muted/30 p-3">
                              <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
                                Homologação PIX sandbox
                              </summary>
                              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                      TXID
                                    </p>
                                    <code className="block break-all rounded border bg-background p-2 text-xs">
                                      {o.pixTxid ?? "-"}
                                    </code>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground">
                                        Valor
                                      </p>
                                      <p className="text-sm font-medium">{brl(o.amount)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground">
                                        Status
                                      </p>
                                      <p className="text-sm font-medium">
                                        {statusLabel[o.status]}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="gap-2"
                                    disabled={
                                      o.status === "paid" ||
                                      !o.pixTxid ||
                                      simulatePaymentMut.isPending
                                    }
                                    onClick={() => simulatePaymentMut.mutate(o.id)}
                                  >
                                    <PlayCircle className="h-4 w-4" />
                                    {simulatePaymentMut.isPending
                                      ? "Simulando..."
                                      : "Simular pagamento sandbox"}
                                  </Button>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                      PIX copia e cola
                                    </p>
                                    <textarea
                                      readOnly
                                      value={o.pixCopyPaste ?? ""}
                                      className="min-h-24 w-full resize-y rounded border bg-background p-2 font-mono text-xs"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Resposta bruta do provider
                                  </p>
                                  <pre className="mt-2 max-h-72 overflow-auto rounded border bg-background p-3 text-xs">
                                    {formatProviderResponse(o.providerResponse)}
                                  </pre>
                                </div>
                              </div>
                            </details>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Créditos por cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length ? (
              <ul className="space-y-2">
                {topClients.map((c) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="font-medium">{brl(c.total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem créditos ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
