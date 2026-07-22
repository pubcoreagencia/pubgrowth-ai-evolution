# PubGrowth AI - Master Context

Documento de continuidade para outra IA ou desenvolvedor.

## Produto

PubGrowth AI e uma plataforma SaaS para uma agencia gerenciar:

- clientes;
- campanhas;
- perfis sociais;
- metricas historicas;
- carteira financeira por cliente;
- portal do cliente;
- recarga por PIX via Banco Inter.

## Infra Atual

- Repositorio: `pubcoreagencia/pubgrowth-ai-evolution`
- Producao: `https://pubgrowthai.contato-pubcore.workers.dev`
- Supabase correto: `rjhnfztjikifymxupagb`
- Runtime: Cloudflare Workers
- PIX: Banco Inter, `INTER_ENV=sandbox`
- Bindings Cloudflare: `INTER_MTLS`, `INTER_TOKEN_CACHE`

## Stack

- TanStack Start
- Vite
- Nitro
- React
- Supabase Auth/Postgres/RLS
- Cloudflare Workers/KV/mTLS
- Banco Inter PIX

## Areas do App

### Agencia/Admin

Rotas em `src/routes/_authenticated`.

Fluxos principais:

- dashboard;
- clientes;
- detalhe do cliente;
- campanhas;
- carteira do cliente;
- perfis sociais;
- configuracoes;
- financeiro admin.

### Portal do Cliente

Rotas em `src/routes/client-portal`.

Fluxos principais:

- dashboard do cliente;
- campanhas;
- redes sociais;
- carteira;
- adicionar saldo via PIX.

### Auth

Arquivos importantes:

- `src/routes/auth.tsx`
- `src/routes/auth.set-password.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/routes/client-portal/route.tsx`
- `src/hooks/use-session.ts`
- `src/integrations/supabase/*`

Cliente convidado deve receber link, entrar no fluxo de criacao de senha e depois acessar continuamente o portal com email/senha.

## Modelo de Dados Principal

Tabelas relevantes:

- `profiles`
- `user_roles`
- `clients`
- `client_users`
- `campaigns`
- `estimation_settings`
- `social_profiles`
- `social_metrics_history`
- `client_wallets`
- `wallet_ledger`
- `payment_orders`

RPCs/funcoes importantes:

- `has_role`
- `current_client_id`
- `wallet_credit`
- `wallet_refund`
- `fund_campaign`
- `confirm_pix_payment`

## Pagamentos PIX

Arquivos principais:

- `src/lib/payments.functions.ts`
- `src/lib/payment-provider/inter-pix.server.ts`
- `src/routes/client-portal/wallet.tsx`
- `src/routes/api/public/webhooks/inter-pix.ts`

Fluxo esperado:

1. cliente logado entra no portal;
2. abre Carteira;
3. solicita saldo via PIX;
4. app cria `payment_orders`;
5. app pega OAuth no Inter via mTLS;
6. app cria cobranca PIX;
7. app salva QR/copia-e-cola/expiracao;
8. Inter chama webhook;
9. webhook valida secret;
10. RPC confirma pagamento, credita carteira e registra ledger.

Estado atual:

- o bug de `pix_txid` duplicado foi corrigido;
- se o Inter sandbox nao responder no OAuth fora da janela operacional, o app mostra erro seguro;
- falta homologar o webhook ponta a ponta dentro da janela do sandbox ou em producao autorizada.

## Mudancas Recentes Importantes

- Supabase migrado para o projeto correto `rjhnfztjikifymxupagb`.
- `contato.pubcore@gmail.com` tratado como admin por migration de bootstrap.
- Cliente convidado agora tem fluxo de definicao de senha.
- Navegacao de cliente na tela Clientes foi corrigida.
- Auth em server functions foi ajustado para usar Bearer real da sessao Supabase.
- PIX `txid` passou a usar componente temporal e aleatorio para evitar colisao.

## Regras de Ouro

- Nunca imprimir secrets, tokens, cookies, localStorage completo, certificados ou service role key.
- Nunca alterar banco remoto, secrets, Cloudflare, Banco Inter ou deploy sem autorizacao.
- Nunca fazer force push, rebase, amend ou reescrever historico publicado.
- Nunca commitar `.env`, `.dev.vars`, certificados ou dumps.
- Preservar runtime Cloudflare Workers; evitar APIs Node-only em codigo server de producao.
- Server functions autenticadas devem usar `requireSupabaseAuth`.
- Webhooks publicos devem ficar em `src/routes/api/public/*` e validar segredo.

## Como Retomar

1. Ler `README.md`.
2. Ler `docs/SETUP.md`.
3. Ler `docs/SECURITY.md`.
4. Ler `docs/PROJECT_STATUS.md`.
5. Rodar:

```powershell
git status
npm.cmd exec -- eslint .
npm.cmd run build
```

6. Confirmar autorizacoes antes de deploy, secrets, Banco Inter ou migrations.
