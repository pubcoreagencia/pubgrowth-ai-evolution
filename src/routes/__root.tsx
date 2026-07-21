import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  isLikelySupabasePublishableKey,
  isLikelySupabaseUrl,
} from "@/integrations/supabase/config";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold tracking-tight text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você tentou acessar não existe.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PubGrowth AI — Relatórios executivos de campanhas do Instagram" },
      {
        name: "description",
        content:
          "Transforme campanhas do Instagram em relatórios executivos claros, métricas confiáveis e dashboards profissionais para seus clientes.",
      },
      { name: "author", content: "PubGrowth AI" },
      {
        property: "og:title",
        content: "PubGrowth AI — Relatórios executivos de campanhas do Instagram",
      },
      {
        property: "og:description",
        content:
          "Transforme campanhas do Instagram em relatórios executivos claros, métricas confiáveis e dashboards profissionais para seus clientes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "PubGrowth AI — Relatórios executivos de campanhas do Instagram",
      },
      {
        name: "twitter:description",
        content:
          "Transforme campanhas do Instagram em relatórios executivos claros, métricas confiáveis e dashboards profissionais para seus clientes.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/0Oc5cY8BBHdoPpuKPeTAjiRJo952/social-images/social-1784057131536-ChatGPT_Image_14_de_jul._de_2026,_16_23_29.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/0Oc5cY8BBHdoPpuKPeTAjiRJo952/social-images/social-1784057131536-ChatGPT_Image_14_de_jul._de_2026,_16_23_29.webp",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const supabaseRuntimeConfigScript = getSupabaseRuntimeConfigScript();

  return (
    <html lang="pt-BR" className="dark">
      <head>
        {supabaseRuntimeConfigScript ? (
          <script
            dangerouslySetInnerHTML={{
              __html: supabaseRuntimeConfigScript,
            }}
          />
        ) : null}
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function getSupabaseRuntimeConfigScript(): string | null {
  if (typeof process === "undefined") return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (
    !isLikelySupabaseUrl(supabaseUrl) ||
    !isLikelySupabasePublishableKey(supabasePublishableKey)
  ) {
    return null;
  }

  const config = JSON.stringify({
    supabaseUrl,
    supabasePublishableKey,
  }).replace(/</g, "\\u003c");

  return `window.__PUBGROWTH_SUPABASE_CONFIG__=${config};`;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
