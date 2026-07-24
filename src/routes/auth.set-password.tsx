import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoleFn } from "@/lib/client-portal.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth/set-password")({
  component: SetPasswordPage,
  head: () => ({
    meta: [
      { title: "Definir senha - PubGrowth AI" },
      {
        name: "description",
        content: "Defina a senha da sua conta para acessar o portal do cliente.",
      },
    ],
  }),
});

const sessionCheckTimeoutMs = 8_000;

function getUrlAuthCode(): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return searchParams.get("code") ?? hashParams.get("code");
}

function cleanSetPasswordUrl() {
  if (window.location.hash || window.location.search) {
    window.history.replaceState(null, "", "/auth/set-password");
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Tempo esgotado ao validar o link.")), timeoutMs);
    }),
  ]);
}

function SetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const finishChecking = (sessionExists: boolean) => {
      if (!active) return;
      setHasSession(sessionExists);
      setChecking(false);
      cleanSetPasswordUrl();
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        finishChecking(Boolean(session));
      }
    });

    async function validateInviteLink() {
      try {
        const code = getUrlAuthCode();
        if (code) {
          const { data, error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            sessionCheckTimeoutMs,
          );
          if (error) throw error;
          finishChecking(Boolean(data.session));
          return;
        }

        const { data } = await withTimeout(supabase.auth.getSession(), sessionCheckTimeoutMs);
        finishChecking(Boolean(data.session));
      } catch {
        finishChecking(false);
      }
    }

    void validateInviteLink();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const goByRole = async () => {
    try {
      const { role } = await getMyRoleFn();
      if (role === "client") navigate({ to: "/client-portal" as never });
      else navigate({ to: "/" });
    } catch {
      navigate({ to: "/auth" });
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirmPassword = String(fd.get("confirmPassword") ?? "");
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas nao conferem.");
      return;
    }

    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({
      password,
      data: {
        ...(userData.user?.user_metadata ?? {}),
        password_setup_required: false,
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Senha definida com sucesso.");
    await goByRole();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          <span>PubGrowth AI</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Defina sua senha</CardTitle>
            <CardDescription>
              Crie uma senha para acessar o portal do cliente nas proximas vezes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <p className="text-sm text-muted-foreground">Validando link...</p>
            ) : hasSession ? (
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar senha"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Este link expirou ou ja foi usado. Solicite um novo link de senha ao
                  administrador.
                </p>
                <Button asChild className="w-full" variant="outline">
                  <Link to="/auth">Voltar para login</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
