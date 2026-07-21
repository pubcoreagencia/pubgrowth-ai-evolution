# PubGrowth AI — Master Context

> Documento de continuidade. Leia inteiro antes de sugerir qualquer alteração. O objetivo é permitir que outra IA (ou desenvolvedor) assuma o projeto sem perder histórico de decisões.

---

## 1. Visão do Produto

PubGrowth AI é uma plataforma SaaS de gestão de campanhas de mídia e crescimento de redes sociais para agências (multi-cliente) com portal do cliente incluso.

**Personas:**
- **Admin principal** (`m4cktheus@gmail.com`) — acesso total.
- **Agência / Operador** — gerencia clientes, campanhas, redes sociais e carteiras.
- **Cliente final** — acesso somente-leitura ao portal e capacidade de recarregar saldo via PIX.

**Diferenciais:**
- Motor próprio de estimativa de campanhas (impressões/alcance a partir de views históricas).
- Histórico temporal de redes sociais com comparação de períodos.
- Carteira financeira por cliente com débito atômico ao financiar campanhas.
- Recarga automática via PIX (Banco Inter PJ) com webhook de conciliação.

---

## 2. Stack e Infraestrutura

| Camada | Tecnologia |
|---|---|
| Framework | TanStack Start v1 (React 19, Vite 7) |
| Styling | Tailwind v4 (via `src/styles.css`) + shadcn/ui |
| Charts | Recharts |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS) — via Lovable Cloud durante dev |
| Runtime prod | Cloudflare Workers (Pages) — mTLS nativo, KV, Assets |
| Deploy | GitHub Actions → `wrangler deploy` |
| Pagamentos | Banco Inter PJ (PIX Cob + Webhook) |

**Arquivos-chave de infra:**
- `wrangler.toml` — bindings `INTER_MTLS` (mtls_certificates) e `INTER_TOKEN_CACHE` (KV).
- `.github/workflows/deploy.yml` — pipeline de deploy.
- `docs/DEPLOY_CLOUDFLARE.md` — passo a passo de setup (upload de cert, secrets, KV).

---

## 3. Modelo de Dados (Supabase)

Schemas: apenas `public`. Nunca tocar em `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.

**Tabelas:**
- `profiles` — extensão de `auth.users` (nome, avatar).
- `user_roles` — enum `app_role` (`admin`, `agency`, `client`). Nunca guardar role em `profiles`.
- `clients` — clientes da agência (nome, empresa, segmento).
- `client_users` — vínculo N:N entre `profiles` e `clients` (para portal do cliente).
- `campaigns` — campanhas com `budget`, `status` (`draft` | `pending_payment` | `funded` | `active` | `completed`), métricas JSONB.
- `estimation_settings` — premissas de mercado por usuário.
- `social_profiles` — perfis por cliente (plataforma, username, url, seguidores, is_active).
- `social_metrics_history` — snapshots temporais (seguidores, alcance, impressões, curtidas, comentários, shares, views, engagement_rate, notes, data). Trigger `sync_current_followers` atualiza `social_profiles.followers` no insert.
- `client_wallets` — saldo atual por cliente. **Nunca pode ficar negativo.**
- `wallet_ledger` — transações (`credit` | `debit` | `refund`), referência opcional a `campaign_id` ou `payment_order_id`.
- `payment_orders` — pedidos PIX (`pending` | `paid` | `expired` | `cancelled`), guarda `txid`, `qrcode`, `copia_e_cola`, valor, cliente.

**Funções SECURITY DEFINER:**
- `has_role(uuid, app_role)` — checagem de papel sem recursão de RLS.
- `current_client_id()` — resolve o cliente vinculado ao usuário logado.
- `wallet_credit(client_id, amount, reason, ref)` — credita saldo atomicamente (`SELECT ... FOR UPDATE`).
- `fund_campaign(campaign_id)` — debita saldo e muda status para `funded`.
- `wallet_refund(...)` — estorna verba.

**RLS:** habilitado em todas as tabelas de `public`. Todas com `GRANT` explícito (padrão: `authenticated` + `service_role`; `anon` só onde há política pública). Cliente lê apenas via `current_client_id()`; agência lê tudo do próprio `auth.uid()`; admin bypassa via `has_role`.

---

## 4. Estrutura de Rotas (`src/routes/`)

```
__root.tsx                                  # shell, head global
index.tsx                                   # redirect para /auth ou área correta
auth.tsx                                    # email/senha + Google, redireciona por role

_authenticated/                             # área agência/admin (gate por role)
  route.tsx                                 # gate + import de localStorage no 1º login
  index.tsx                                 # dashboard agência
  campaigns.index.tsx | new.tsx | $id.tsx   # CRUD + FinancialControls (financiar/ativar/estornar)
  clients.index.tsx | new.tsx | $id.tsx     # CRUD clientes + gestão de acesso (client_users)
  clients.$id.wallet.tsx                    # carteira + ledger do cliente
  clients.$id.social.$profileId.tsx         # dashboard evolução redes sociais
  settings.tsx                              # estimation_settings
  admin.financial.tsx                       # monitor global de payment_orders

client-portal/                              # área somente-leitura do cliente final
  route.tsx                                 # gate role = client
  index.tsx                                 # dashboard KPIs
  campaigns.tsx | social.tsx | wallet.tsx   # visão do cliente + botão recarga PIX

api/
  public/webhooks/inter-pix.ts              # webhook Banco Inter (HMAC via Web Crypto)
```

---

## 5. Server Functions e Libs

`src/lib/` — camada de negócio, importável por rotas (client-safe):
- `campaigns.functions.ts`, `clients.functions.ts`, `estimation-settings.functions.ts`
- `social-profiles.functions.ts`, `social-metrics.functions.ts`
- `wallet.functions.ts`, `payments.functions.ts`
- `campaign-estimates.ts` — motor de cálculo (**preservado do projeto original — não alterar sem autorização**).
- `payment-provider/inter-pix.server.ts` — cliente Banco Inter (usa `env.INTER_MTLS.fetch`, cache token em KV).

Todas as functions autenticadas usam `.middleware([requireSupabaseAuth])`. Middleware `attachSupabaseAuth` registrado em `src/start.ts`.

---

## 6. Etapas Concluídas

1. ✅ **Auditoria** do repo `pubcoreagencia/pubgrowthai` e port do código legado (localStorage) para o template TanStack Start.
2. ✅ **Migração para Lovable Cloud** — Supabase Auth (email/senha + Google), tabelas base, RLS, import automática do localStorage no 1º login.
3. ✅ **Redes sociais** — `social_profiles` + `social_metrics_history` com trigger de sync e dashboard comparativo.
4. ✅ **Carteira financeira** — `client_wallets` + `wallet_ledger` + funções atômicas + UI ledger + financiamento de campanhas.
5. ✅ **Portal do cliente** — role `client`, `client_users`, RLS via `current_client_id()`, rotas em `client-portal/`, convite pela agência.
6. ✅ **Admin principal + PIX Inter** — promoção de `m4cktheus@gmail.com`, `payment_orders`, webhook, UI de recarga.
7. ✅ **Infra Cloudflare-native** — `wrangler.toml` com mTLS + KV, workflow GitHub Actions, webhook via Web Crypto, docs de deploy.

---

## 7. Estado Atual / Pontos de Atenção

- App roda 100% no runtime Workers (nenhum proxy externo).
- Deploy contínuo depende de secrets configurados na Cloudflare (ver `docs/DEPLOY_CLOUDFLARE.md`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET`, `INTER_PIX_KEY`, `INTER_WEBHOOK_SECRET`. `INTER_ENV` fica em `[vars]` do `wrangler.toml`. Certificado mTLS enviado via `wrangler mtls-certificate upload`.
- Não há testes automatizados ainda.
- Sem observabilidade além dos logs do Cloudflare/Supabase.
- Emails transacionais ainda usam remetente padrão do Supabase (sem domínio próprio).
- Sem PWA/mobile push.
- Não existe módulo de relatórios/exportação (PDF/CSV).
- Motor de estimativas ainda é regra fixa — não há IA real acoplada, apesar do nome.

---

## 8. Próximos Passos Sugeridos (backlog priorizado)

1. **Homologação do fluxo PIX end-to-end** em produção (upload cert, cadastrar webhook no Inter, teste com QR real).
2. **Notificações** — email transacional (recarga confirmada, campanha ativada, saldo baixo) via domínio próprio.
3. **Relatórios do cliente** — export PDF/CSV de campanha e evolução de redes sociais.
4. **IA real** — usar Lovable AI Gateway para: (a) sugerir orçamento ideal por campanha a partir do histórico, (b) gerar insights textuais no dashboard de redes sociais.
5. **Auditoria / logs** — tabela `audit_log` para ações sensíveis (ajuste manual de saldo, mudança de role, exclusão).
6. **Convites por email** — hoje o admin vincula manualmente; falta fluxo de convite com link mágico.
7. **Multi-agência (workspaces)** — explicitamente adiado pelo usuário; reabrir só quando pedido.
8. **Testes** — smoke tests Playwright para fluxos críticos (login, financiar campanha, webhook PIX).
9. **Observabilidade** — Sentry/Logtail no Worker.
10. **Onboarding do cliente** — wizard no primeiro login do portal.

---

## 9. Regras de Ouro para a Próxima IA

- **Nunca** remover ou refatorar `campaign-estimates.ts` sem autorização — é o motor original preservado.
- **Nunca** recriar o projeto do zero: o código atual é a base autoritativa.
- **Nunca** guardar role em `profiles`; sempre `user_roles` + `has_role()`.
- **Nunca** deixar tabela em `public` sem `GRANT` e RLS.
- **Nunca** editar arquivos auto-gerados: `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`, `.env`, `supabase/config.toml`, `src/routeTree.gen.ts`.
- **Nunca** referir-se a "Supabase" na UI/mensagens ao usuário — usar "Lovable Cloud / backend".
- **Nunca** reintroduzir dependências Node-only (child_process, sharp, undici, etc.) — o runtime é Cloudflare Workers.
- Server functions autenticadas SEMPRE usam `requireSupabaseAuth`; público (webhooks) vai em `src/routes/api/public/*` com verificação de assinatura.
- Preservar identidade visual atual (Tailwind v4 tokens em `src/styles.css`, componentes shadcn) — não trocar por temas genéricos.

---

## 10. Como Retomar

1. Ler este documento inteiro.
2. Ler `docs/DEPLOY_CLOUDFLARE.md` para o estado de infra.
3. Rodar auditoria rápida: listar `src/routes/`, `src/lib/`, migrations em `supabase/migrations/`.
4. Perguntar ao usuário qual item do backlog (seção 8) atacar antes de codar.
