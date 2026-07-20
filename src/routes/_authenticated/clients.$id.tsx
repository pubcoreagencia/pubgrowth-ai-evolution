import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getClientFn } from "@/lib/clients.functions";
import {
  listSocialProfilesByClientFn,
  createSocialProfileFn,
  updateSocialProfileFn,
  deleteSocialProfileFn,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type SocialProfile,
} from "@/lib/social-profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { ArrowLeft, PlusCircle, Trash2, LineChart, Archive, ArchiveRestore } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientDetailPage,
  head: () => ({
    meta: [{ title: "Cliente — PubGrowth AI" }],
  }),
});

const platformLabel = (p: SocialPlatform) =>
  SOCIAL_PLATFORMS.find((x) => x.value === p)?.label ?? p;

const platformColor: Record<SocialPlatform, string> = {
  instagram: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  tiktok: "bg-neutral-900/10 text-neutral-900 dark:text-neutral-100",
  youtube: "bg-red-500/10 text-red-600 dark:text-red-400",
  facebook: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

function ClientDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: () => getClientFn({ data: { id } }),
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["social-profiles", id],
    queryFn: () => listSocialProfilesByClientFn({ data: { clientId: id } }),
    initialData: [] as SocialProfile[],
  });

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["social-profiles", id] });

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createSocialProfileFn({
        data: {
          clientId: id,
          platform,
          profileName: String(fd.get("profileName") ?? "").trim(),
          username: String(fd.get("username") ?? "").trim(),
          profileUrl: String(fd.get("profileUrl") ?? "").trim() || null,
          avatarUrl: String(fd.get("avatarUrl") ?? "").trim() || null,
          currentFollowers: Number(fd.get("currentFollowers") ?? 0) || 0,
        },
      });
      toast.success("Perfil adicionado");
      setOpen(false);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async (p: SocialProfile) => {
    try {
      await updateSocialProfileFn({ data: { id: p.id, isActive: !p.isActive } });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const onDelete = async (pid: string) => {
    if (!confirm("Remover este perfil e todo o histórico de métricas?")) return;
    try {
      await deleteSocialProfileFn({ data: { id: pid } });
      toast.success("Perfil removido");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const active = profiles.filter((p) => p.isActive);
  const archived = profiles.filter((p) => !p.isActive);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para clientes
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {client?.name ?? "Cliente"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {client?.company ?? "—"}
            {client?.segment ? ` · ${client.segment}` : ""}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" /> Adicionar perfil
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo perfil social</DialogTitle>
            </DialogHeader>
            <form onSubmit={onCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Plataforma</Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as SocialPlatform)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="profileName">Nome do perfil*</Label>
                  <Input id="profileName" name="profileName" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username*</Label>
                  <Input id="username" name="username" required placeholder="@handle" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profileUrl">URL</Label>
                <Input id="profileUrl" name="profileUrl" type="url" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="avatarUrl">URL do avatar</Label>
                <Input id="avatarUrl" name="avatarUrl" type="url" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currentFollowers">Seguidores atuais</Label>
                <Input
                  id="currentFollowers"
                  name="currentFollowers"
                  type="number"
                  min={0}
                  defaultValue={0}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  Adicionar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Perfis ativos ({active.length})</h2>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum perfil ativo. Adicione o primeiro perfil deste cliente.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {active.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                clientId={id}
                onArchive={() => onToggleActive(p)}
                onDelete={() => onDelete(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-medium text-muted-foreground">
            Arquivados ({archived.length})
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {archived.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                clientId={id}
                onArchive={() => onToggleActive(p)}
                onDelete={() => onDelete(p.id)}
                dimmed
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  clientId,
  onArchive,
  onDelete,
  dimmed = false,
}: {
  profile: SocialProfile;
  clientId: string;
  onArchive: () => void;
  onDelete: () => void;
  dimmed?: boolean;
}) {
  return (
    <Card className={dimmed ? "opacity-70" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.username} />
            <AvatarFallback>
              {profile.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{profile.profileName}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
          </div>
          <Badge className={platformColor[profile.platform]} variant="secondary">
            {platformLabel(profile.platform)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">
          {profile.currentFollowers.toLocaleString("pt-BR")}
        </div>
        <p className="text-xs text-muted-foreground">seguidores atuais</p>

        <div className="mt-4 flex gap-2">
          <Button asChild size="sm" variant="secondary" className="flex-1 gap-1.5">
            <Link
              to="/clients/$id/social/$profileId"
              params={{ id: clientId, profileId: profile.id }}
            >
              <LineChart className="h-4 w-4" /> Evolução
            </Link>
          </Button>
          <Button size="icon" variant="ghost" onClick={onArchive} aria-label="Arquivar">
            {profile.isActive ? (
              <Archive className="h-4 w-4" />
            ) : (
              <ArchiveRestore className="h-4 w-4" />
            )}
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Remover">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}