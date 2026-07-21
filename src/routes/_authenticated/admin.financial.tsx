import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listAllPaymentOrdersFn, type PaymentOrder } from "@/lib/payments.functions";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Clock, CheckCircle2, TrendingUp } from "lucide-react";

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
  head: () => ({ meta: [{ title: "Financeiro — PubGrowth AI" }] }),
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

function AdminFinancialPage() {
  const q = useQuery({
    queryKey: ["admin-payment-orders"],
    queryFn: () => listAllPaymentOrdersFn(),
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

  // Top clients by credited amount
  const byClient = new Map<string, { name: string; total: number }>();
  for (const o of paid) {
    const key = o.clientId;
    const cur = byClient.get(key) ?? { name: o.clientName ?? "—", total: 0 };
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
                      <th className="pb-2">Pago em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-t">
                        <td className="py-2">
                          {new Date(o.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2">{o.clientName ?? "—"}</td>
                        <td className="py-2">{brl(o.amount)}</td>
                        <td className="py-2">
                          <Badge variant={statusVariant[o.status]}>
                            {statusLabel[o.status]}
                          </Badge>
                        </td>
                        <td className="py-2">
                          {o.paidAt ? new Date(o.paidAt).toLocaleString("pt-BR") : "—"}
                        </td>
                      </tr>
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