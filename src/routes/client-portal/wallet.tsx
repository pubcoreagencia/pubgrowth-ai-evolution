import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  createMyPixOrderFn,
  getPaymentOrderFn,
  listMyPaymentOrdersFn,
  type PaymentOrder,
} from "@/lib/payments.functions";
import { getMyPortalDataFn } from "@/lib/client-portal.functions";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Wallet as WalletIcon, TrendingUp, TrendingDown, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/client-portal/wallet")({
  component: ClientWalletPage,
  head: () => ({ meta: [{ title: "Carteira — PubGrowth AI" }] }),
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const statusLabel: Record<PaymentOrder["status"], string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  expired: "Expirado",
  cancelled: "Cancelado",
  requires_review: "Em revisão",
};

const statusVariant: Record<PaymentOrder["status"], "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  paid: "default",
  expired: "outline",
  cancelled: "destructive",
  requires_review: "outline",
};

function ClientWalletPage() {
  const qc = useQueryClient();
  const portalQ = useQuery({ queryKey: ["client-portal-data"], queryFn: () => getMyPortalDataFn() });
  const ordersQ = useQuery({
    queryKey: ["my-payment-orders"],
    queryFn: () => listMyPaymentOrdersFn(),
  });

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [activeOrder, setActiveOrder] = useState<PaymentOrder | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useServerFn(createMyPixOrderFn);
  const createMut = useMutation({
    mutationFn: (v: number) => create({ data: { amount: v } }),
    onSuccess: (order) => {
      setActiveOrder(order);
      setOpen(false);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["my-payment-orders"] });
      toast.success("Cobrança PIX gerada. Escaneie o QR ou copie o código.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Poll active order until settled
  const activePoll = useQuery({
    queryKey: ["payment-order", activeOrder?.id],
    queryFn: () => getPaymentOrderFn({ data: { id: activeOrder!.id } }),
    enabled: !!activeOrder && activeOrder.status === "pending",
    refetchInterval: 4000,
  });

  const current = activePoll.data ?? activeOrder;
  if (current && activeOrder && current.status !== activeOrder.status) {
    if (current.status === "paid") {
      toast.success(`Pagamento confirmado: ${brl(current.amount)} adicionados à carteira.`);
      qc.invalidateQueries({ queryKey: ["client-portal-data"] });
      qc.invalidateQueries({ queryKey: ["my-payment-orders"] });
    }
    setActiveOrder(current);
  }

  const wallet = portalQ.data?.wallet;
  const totalCredited = (ordersQ.data ?? [])
    .filter((o) => o.status === "paid")
    .reduce((s, o) => s + o.amount, 0);
  const totalSpent = Math.max(0, totalCredited - (wallet?.balance ?? 0));

  const handleCopy = async () => {
    if (!current?.pixCopyPaste) return;
    await navigator.clipboard.writeText(current.pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Carteira</h1>
          <p className="text-sm text-muted-foreground">
            Adicione saldo via PIX e acompanhe suas recargas.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Adicionar saldo via PIX</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Saldo disponível"
          value={brl(wallet?.balance ?? 0)}
          icon={<WalletIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Total creditado"
          value={brl(totalCredited)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Total utilizado"
          value={brl(totalSpent)}
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      {current && current.status === "pending" && (
        <Card>
          <CardHeader>
            <CardTitle>Cobrança ativa — {brl(current.amount)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col items-center justify-center gap-2">
              {current.pixQrcode ? (
                <img
                  src={
                    current.pixQrcode.startsWith("data:")
                      ? current.pixQrcode
                      : `data:image/png;base64,${current.pixQrcode}`
                  }
                  alt="QR Code PIX"
                  className="h-56 w-56 rounded-md border bg-white p-2"
                />
              ) : (
                <div className="grid h-56 w-56 place-items-center rounded-md border text-sm text-muted-foreground">
                  QR indisponível
                </div>
              )}
              <Badge variant={statusVariant[current.status]}>{statusLabel[current.status]}</Badge>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">PIX copia e cola</Label>
                <div className="mt-1 flex gap-2">
                  <textarea
                    readOnly
                    value={current.pixCopyPaste ?? ""}
                    className="h-28 w-full resize-none rounded-md border bg-muted/40 p-2 font-mono text-xs"
                  />
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="mr-1 h-3 w-3" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" /> Copiar código
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A carteira é atualizada automaticamente assim que o pagamento é confirmado pelo banco.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de recargas</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersQ.data && ordersQ.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Valor</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersQ.data.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="py-2">{new Date(o.createdAt).toLocaleString("pt-BR")}</td>
                      <td className="py-2">{brl(o.amount)}</td>
                      <td className="py-2">
                        <Badge variant={statusVariant[o.status]}>{statusLabel[o.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma recarga ainda.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar saldo via PIX</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pix-amount">Valor (R$)</Label>
              <Input
                id="pix-amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const v = Number(amount);
                if (!Number.isFinite(v) || v <= 0) {
                  toast.error("Informe um valor válido.");
                  return;
                }
                createMut.mutate(v);
              }}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Gerando..." : "Gerar PIX"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}