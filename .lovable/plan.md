# Plano: Admin Principal + Recarga PIX (Banco Inter PJ)

## 1. Admin principal — m4cktheus@gmail.com

O sistema **já possui** o esquema de roles necessário:
- Enum `app_role` com `admin | user | client`
- Tabela `user_roles` (separada de `profiles`, como manda a boa prática)
- Função `has_role(_user_id, _role)` `SECURITY DEFINER` usada em todas as RLS
- Trigger `handle_new_user` cria role `user` por padrão

**O que farei (uma migration):**
- Promover a conta existente `m4cktheus@gmail.com` a `admin`:
  ```sql
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin' FROM auth.users WHERE email = 'm4cktheus@gmail.com'
  ON CONFLICT (user_id, role) DO NOTHING;
  ```
- Ajustar `handle_new_user` para que, se o e-mail cadastrado for `m4cktheus@gmail.com`, a role atribuída seja `admin` (garantia caso a conta seja recriada).
- **Nada mais** muda: todas as policies já fazem bypass via `has_role(auth.uid(), 'admin')`. Nenhuma tabela/policy nova é necessária para "acesso total".

Pré-requisito: a conta precisa existir em `auth.users`. Se ainda não fez login com esse e-mail, cadastre em `/auth` primeiro — a migration é idempotente e pode rodar antes ou depois.

## 2. Recarga PIX via Banco Inter PJ

### 2.1 Nova tabela `payment_orders`

| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | |
| user_id | uuid → auth.users | dono do pedido (usuário cliente logado) |
| client_id | uuid → clients | carteira alvo |
| amount | numeric(14,2) | > 0 |
| status | enum `payment_status` | `pending / paid / expired / cancelled` |
| pix_txid | text unique | txid Inter (E2E) |
| pix_qrcode | text | imagem base64 do QR |
| pix_copy_paste | text | BR Code |
| external_payment_id | text | id da cobrança no Inter |
| expires_at | timestamptz | |
| paid_at | timestamptz | |
| created_at / updated_at | timestamptz | |

RLS:
- `SELECT`: dono (`user_id = auth.uid()`) **ou** admin
- `INSERT/UPDATE`: **negado a clientes**; feito somente pelas server functions com `supabaseAdmin` após validação
- Grants: `authenticated` (SELECT via policy), `service_role` (ALL)

`wallet_ledger` continua imutável — o crédito PIX passa **exclusivamente** pela função `wallet_credit` (já existente, `SECURITY DEFINER`).

### 2.2 Fluxo completo

```text
Cliente no /client-portal/wallet
   │ clica "Adicionar saldo via PIX", informa valor
   ▼
createPixOrderFn (server fn, requireSupabaseAuth)
   │ valida role=client, resolve client_id via current_client_id()
   │ chama InterPixProvider.createCharge(amount, txid)
   │ INSERT payment_orders (status=pending, qrcode, copia-e-cola)
   ▼
Cliente paga o QR no app do banco
   ▼
Banco Inter → POST /api/public/webhooks/inter-pix
   │ mTLS + validação por header/secret compartilhado
   │ marca payment_orders.status=paid, paid_at=now()
   │ chama wallet_credit(client_id, amount, 'Recarga PIX')
   │   → wallet_ledger (credit) + client_wallets.balance += amount
   ▼
Portal do cliente faz polling (a cada 4s até 5min) em getPixOrderFn
   → detecta status=paid → toast + refetch da carteira
```

Idempotência: webhook usa `pix_txid` como chave; reprocessos não duplicam crédito (checa `status='paid'` antes de creditar).

### 2.3 Camada de pagamento

```
src/lib/payment-provider/
  types.ts               # PaymentProvider interface
  inter-pix.server.ts    # cliente Inter (mTLS + OAuth) — server-only
  index.server.ts        # factory
```

Chamada apenas por server functions e pelo webhook. Nunca importada por rota/cliente.

### 2.4 Server functions e rotas novas

- `src/lib/payments.functions.ts`
  - `createPixOrderFn` (client only)
  - `getPixOrderFn` (dono ou admin) — polling
  - `listMyPixOrdersFn` (client)
  - `listAllPixOrdersFn` (admin) — para o painel financeiro
- `src/routes/api/public/webhooks/inter-pix.ts` — webhook público com validação de assinatura/segredo
- `src/routes/client-portal/wallet.tsx` — nova página de carteira
- `src/routes/_authenticated/admin.financial.tsx` — visão financeira admin

### 2.5 Secrets necessários (Banco Inter PJ — API PIX Cob)

Vou solicitar via tool segura (add_secret):
- `INTER_CLIENT_ID`
- `INTER_CLIENT_SECRET`
- `INTER_CERT_PEM` (certificado mTLS emitido pelo Inter)
- `INTER_KEY_PEM` (chave privada correspondente)
- `INTER_PIX_KEY` (chave PIX da conta PJ que receberá — CNPJ/e-mail/EVP)
- `INTER_WEBHOOK_SECRET` (segredo compartilhado adicional na URL/header — defesa em profundidade além do mTLS)
- `INTER_ENV` (`sandbox` ou `production`)

Onde obter no Banco Inter:
- Login no **Internet Banking PJ** → **API Comunidade** → **Aplicações** → criar app com escopos `cob.write cob.read pix.read webhook.write webhook.read`
- Gerar certificado mTLS na mesma tela (baixar `.crt` e `.key`, colar como PEM nas secrets)

## 3. Portal do Cliente — `/client-portal/wallet`

Layout (mantém tokens e componentes shadcn atuais):

```text
┌─ Saldo disponível ─┐ ┌─ Total creditado ─┐ ┌─ Total utilizado ─┐
│  R$ 1.240,00       │ │  R$ 5.000,00       │ │  R$ 3.760,00       │
└────────────────────┘ └────────────────────┘ └────────────────────┘

[ Adicionar saldo via PIX ]  → Dialog: valor → gera cobrança

Cobrança ativa (se pending):
  QR Code  |  Copia e Cola  |  Valor  |  Expira em mm:ss  |  Status

Últimas recargas (tabela: data | valor | status)
```

## 4. Área Administrativa — `/admin/financial`

- KPIs: pendentes, aprovados hoje/mês, total recebido
- Tabela: todos os `payment_orders` (filtros por cliente, status, período)
- Créditos por cliente (top 10)
- Link para o ledger de cada cliente

Item de menu "Financeiro" na `AppSidebar` visível somente se `has_role(admin)`.

## 5. Detalhes técnicos

- Migration única cria enum `payment_status`, tabela `payment_orders`, grants, RLS, trigger `updated_at`, e promove m4cktheus@gmail.com.
- Webhook em `src/routes/api/public/webhooks/inter-pix.ts` usa `supabaseAdmin` (import dinâmico dentro do handler) apenas após validação.
- `wallet_credit` já roda `SECURITY DEFINER` e faz `FOR UPDATE` no saldo — reutilizado sem alteração.
- `wallet_ledger` permanece imutável (trigger `ledger_immutable` já existe).
- Polling client-side simples via TanStack Query com `refetchInterval` até `status !== 'pending'`.
- Sem alteração no design system.

## 6. Ordem de execução (após aprovação)

1. Migration (tabela + role admin) — via `supabase--migration`
2. Solicitar secrets do Banco Inter (`add_secret`)
3. Camada `payment-provider/inter-pix.server.ts`
4. Server functions + webhook
5. Página `/client-portal/wallet`
6. Página `/admin/financial` + item na sidebar

Aprova para eu começar pela migration e pela solicitação das secrets?
