# Portal do Cliente — Proposta

## 1. Modelo de autenticação

Um único sistema de auth (Supabase) com **role** determinando a experiência:

- Roles em `user_roles` (enum `app_role` já existente): `admin` (agência), `user` (padrão atual), e **novo `client`**.
- Nova tabela `client_users` liga o `auth.user` ao `client_id` que ele pode ver:

```text
client_users
  id           uuid pk
  user_id      uuid → auth.users (unique)   -- 1 login = 1 cliente
  client_id    uuid → clients
  invited_by   uuid → auth.users (agência)
  created_at   timestamptz
```

Regra: um usuário `client` tem exatamente 1 linha em `client_users`. A agência (`admin`/`user`) não usa essa tabela.

Fluxo de criação (feito pela agência):
- Na página do cliente, botão **"Convidar acesso do cliente"** → server fn cria o usuário via `supabaseAdmin.auth.admin.inviteUserByEmail`, insere `user_roles(client)` e `client_users(user_id, client_id)`.
- Cliente recebe email, define senha e cai em `/client-portal`.

Login: mesma tela `/auth`. Após login, um `redirectByRole()` decide:
- role `client` → `/client-portal`
- caso contrário → `/` (área da agência)

Cliente que tentar acessar `/campaigns`, `/clients` etc. é redirecionado para `/client-portal` (guarda no layout `_authenticated`).

## 2. Estrutura de RLS

Helper `security definer` para evitar recursão:

```sql
create function public.current_client_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select client_id from public.client_users where user_id = auth.uid() limit 1
$$;
```

Adicionar **uma policy SELECT por tabela** para role `client`, mantendo policies existentes de `admin`/dono:

| Tabela | Policy nova (SELECT) |
|---|---|
| `clients` | `id = current_client_id()` |
| `campaigns` | `client_id = current_client_id()` |
| `social_profiles` | `client_id = current_client_id()` |
| `social_metrics_history` | `social_profile_id in (select id from social_profiles where client_id = current_client_id())` |
| `client_wallets` | `client_id = current_client_id()` |
| `wallet_ledger` | `client_id = current_client_id()` |
| `client_users` | `user_id = auth.uid()` |

**Nenhuma** policy INSERT/UPDATE/DELETE é adicionada para role `client` — leitura pura. As RPCs financeiras (`wallet_credit`, `fund_campaign`, etc.) já checam `has_role('admin')` e continuarão rejeitando clientes.

`estimation_settings` e `profiles` (da agência) não recebem acesso ao role `client`.

## 3. Fluxo de login

```text
[/auth]  ── login OK ──▶  lê user_roles
                          │
              role=client │        role=admin/user
                          ▼                ▼
                  /client-portal        /  (dashboard agência)
```

- Layout `_authenticated/route.tsx` (managed) já redireciona não-autenticado para `/auth`.
- Adicionar novo layout `_client/route.tsx` (`ssr: false`) que exige role `client`; agência é redirecionada para `/`.
- Componente `<RoleRedirect />` no `/auth` após sign-in bem-sucedido usa `has_role` para escolher destino.
- `app-sidebar` (agência) esconde itens se role = client; portal do cliente tem sua própria sidebar/topbar minimalista.

## 4. Wireframe do portal

Rota: `/client-portal` (+ sub-rotas read-only).

```text
┌─────────────────────────────────────────────────────────┐
│  [Logo agência]   Nome do cliente         Última atu... │
├─────────────────────────────────────────────────────────┤
│ [Campanhas ativas] [Investido] [Saldo] [Crescimento %] │
├─────────────────────────────────────────────────────────┤
│  Campanhas                                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Nome │ Plataforma │ Obj │ Período │ Budget │ St.│   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Redes sociais                                          │
│  [IG card + sparkline] [TikTok] [YouTube] [Facebook]    │
├─────────────────────────────────────────────────────────┤
│  Financeiro                                             │
│  Saldo: R$ ...   Investido: R$ ...                      │
│  Histórico (últimas 10 movimentações — read only)       │
└─────────────────────────────────────────────────────────┘
```

Sub-rotas (opcionais, todas read-only):
- `/client-portal` — dashboard
- `/client-portal/campaigns/$id` — detalhes da campanha (mesmos gráficos, sem botões financeiros)
- `/client-portal/social/$profileId` — evolução do perfil

Identidade visual: reaproveita `surface-card`, `stat-card`, cores e componentes shadcn atuais.

## 5. Detalhes técnicos

- **Migração**: adiciona valor `'client'` ao enum `app_role`, cria `client_users` (+ GRANTs + RLS), cria função `current_client_id()`, adiciona policies SELECT listadas acima.
- **Server functions novas** (`.middleware([requireSupabaseAuth])`, sem `supabaseAdmin` na leitura — RLS resolve o escopo):
  - `getMyClientPortalFn` → retorna cliente + KPIs agregados
  - `listMyCampaignsFn`, `listMySocialProfilesFn`, `getMyWalletFn`, `listMyLedgerFn`
  - `inviteClientUserFn` (admin only, usa `supabaseAdmin` para criar auth user + linhas)
  - `revokeClientUserFn` (admin only)
- **Componentes** em `src/components/client-portal/` (Header, KPICards, CampaignsList, SocialGrid, WalletSummary).
- **Rotas**: `src/routes/_client/route.tsx`, `_client/index.tsx`, (sub-rotas opcionais).
- **Guarda de role**: função `has_role` já existe; no lado cliente, `_client/route.tsx` faz `supabase.rpc('has_role', { _user_id, _role: 'client' })` — redireciona `/` se falso.
- **UI da agência**: em `/clients/$id`, novo card **"Acesso do cliente"** com email do usuário vinculado (se houver) e botões **Convidar** / **Revogar**.

## Fora de escopo (próxima etapa)

- Envio de relatório PDF/email
- Personalização de whitelabel (logo/cor por cliente)
- Notificações in-app para o cliente
