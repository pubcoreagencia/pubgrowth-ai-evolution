import { createFileRoute, Outlet, redirect, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Sparkles } from "lucide-react";

export const Route = createFileRoute("/client-portal")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: isClient } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "client",
    });
    if (!isClient) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: ClientPortalLayout,
});

function ClientPortalLayout() {
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Conta";
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur md:px-6">
        <Link to="/client-portal" className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[image:var(--gradient-primary)] glow-ring">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">
              PubGrowth <span className="text-gradient">AI</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Portal do cliente
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            to="/client-portal"
            activeOptions={{ exact: true }}
            className="text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            to="/client-portal/wallet"
            className="text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-foreground"
          >
            Carteira
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.user_metadata?.avatar_url as string | undefined} />
            <AvatarFallback className="text-xs">{initials || "CL"}</AvatarFallback>
          </Avatar>
          <div className="hidden text-right leading-tight md:block">
            <div className="text-xs font-medium">{displayName}</div>
            <div className="text-[10px] text-muted-foreground">{user?.email ?? ""}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            aria-label="Sair"
            className="h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}