import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listClientsFn,
  createClientFn,
  deleteClientFn,
  type Client,
} from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, PlusCircle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
  head: () => ({
    meta: [
      { title: "Clientes — PubGrowth AI" },
      { name: "description", content: "Gerencie a carteira de clientes das suas campanhas." },
    ],
  }),
});

function ClientsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClientsFn(),
    initialData: [] as Client[],
  });
  const [saving, setSaving] = useState(false);

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    setSaving(true);
    try {
      await createClientFn({
        data: {
          name,
          company: String(fd.get("company") ?? "").trim() || null,
          segment: String(fd.get("segment") ?? "").trim() || null,
          notes: String(fd.get("notes") ?? "").trim() || null,
        },
      });
      form.reset();
      toast.success("Cliente adicionado");
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Remover este cliente?")) return;
    try {
      await deleteClientFn({ data: { id } });
      toast.success("Cliente removido");
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    }
  };

  if (pathname.startsWith("/clients/")) {
    return <Outlet />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre os clientes que você atende para organizar as campanhas.
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Nome*</Label>
                <Input id="c-name" name="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-company">Empresa</Label>
                <Input id="c-company" name="company" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-segment">Segmento</Label>
                <Input id="c-segment" name="segment" placeholder="Ex.: e-commerce, infoproduto" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-notes">Observações</Label>
                <Input id="c-notes" name="notes" />
              </div>
              <Button type="submit" disabled={saving} className="w-full gap-2">
                <PlusCircle className="h-4 w-4" /> Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sua carteira ({clients.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => navigate({ to: "/clients/$id", params: { id: c.id } })}
                      >
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.company ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.segment ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild size="sm" variant="ghost" className="gap-1">
                              <Link to="/clients/$id" params={{ id: c.id }}>
                                Abrir <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDelete(c.id);
                              }}
                              aria-label="Remover cliente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
