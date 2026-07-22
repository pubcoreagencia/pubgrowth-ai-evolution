# Deploy Cloudflare Workers

Este documento descreve o deploy self-hosted do PubGrowth AI na conta Cloudflare do projeto.

## Estado Atual

- Worker: `pubgrowthai`
- Producao: `https://pubgrowthai.contato-pubcore.workers.dev`
- Supabase correto: `rjhnfztjikifymxupagb`
- Banco Inter atual: `INTER_ENV=sandbox`
- Bindings importantes:
  - `INTER_MTLS`
  - `INTER_TOKEN_CACHE`

Nao coloque PEM, chave privada, tokens ou secrets neste repositorio.

## Pre-Requisitos

- Node/npm instalados.
- Acesso ao repositorio GitHub `pubcoreagencia/pubgrowth-ai-evolution`.
- Acesso autorizado a Cloudflare.
- Acesso autorizado ao Supabase correto.
- Credenciais/certificado Banco Inter adequados ao ambiente alvo.

## Variaveis e Secrets

Secrets Cloudflare necessarias:

```powershell
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_PUBLISHABLE_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put INTER_CLIENT_ID
wrangler secret put INTER_CLIENT_SECRET
wrangler secret put INTER_PIX_KEY
wrangler secret put INTER_WEBHOOK_SECRET
```

Variavel nao secreta no `wrangler.toml`:

```toml
[vars]
INTER_ENV = "sandbox"
```

Para producao Banco Inter, trocar para `production` somente com autorizacao e com certificado/credenciais de producao.

## Bindings

`INTER_MTLS` apresenta o certificado do Banco Inter na chamada HTTPS. O certificado e a chave privada devem ser enviados ao Cloudflare via Wrangler, nunca versionados.

```powershell
wrangler mtls-certificate upload --cert .\cert.pem --key .\key.pem --name inter-pix-sandbox
```

`INTER_TOKEN_CACHE` guarda o token OAuth do Inter em KV para reduzir chamadas de token.

```powershell
wrangler kv namespace create INTER_TOKEN_CACHE
```

Depois de criar ou trocar esses recursos, atualizar os IDs no `wrangler.toml` com cuidado.

## Build Local

```powershell
npm.cmd install
npm.cmd exec -- eslint .
npm.cmd run build
```

## Deploy Manual

Deploy requer autorizacao explicita.

```powershell
npm.cmd run build
npm.cmd exec -- wrangler deploy
```

Nao rode deploy se:

- o build falhou;
- ha secrets no diff;
- o ambiente alvo nao foi confirmado;
- houve mudanca de banco pendente;
- houve troca de certificado/credenciais Inter sem validacao.

## GitHub Actions

Se o projeto usar deploy automatico por push em `main`, os secrets do GitHub devem existir:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Confirme o workflow antes de assumir que o deploy automatico esta ativo.

## Webhook Banco Inter

Endpoint do app:

```text
https://pubgrowthai.contato-pubcore.workers.dev/api/public/webhooks/inter-pix
```

O webhook deve enviar o segredo configurado como `INTER_WEBHOOK_SECRET`, por query string ou header suportado pelo app.

Teste de rejeicao sem secret, somente quando autorizado:

```powershell
curl.exe -i -X POST https://pubgrowthai.contato-pubcore.workers.dev/api/public/webhooks/inter-pix -H "content-type: application/json" -d "{\"pix\":[]}"
```

Resposta esperada: `401 Unauthorized`.

## Sandbox vs Producao Inter

O ambiente atual e sandbox. O Inter informou ao usuario que o sandbox pode ter janela operacional ate 20h. Timeouts no OAuth fora dessa janela podem ser comportamento do sandbox.

Em producao PIX deve operar 24/7, mas exige:

- `INTER_ENV=production`;
- certificado mTLS de producao;
- credenciais de producao;
- chave PIX valida no ambiente de producao;
- webhook configurado para a URL de producao.

## Checklist de Deploy

- [ ] `npm.cmd exec -- eslint .` passou.
- [ ] `npm.cmd run build` passou.
- [ ] Nenhum secret aparece em `git diff`.
- [ ] Ambiente alvo confirmado.
- [ ] Supabase correto confirmado: `rjhnfztjikifymxupagb`.
- [ ] `INTER_ENV` confirmado.
- [ ] `INTER_MTLS` e `INTER_TOKEN_CACHE` confirmados.
- [ ] Webhook Inter validado quando aplicavel.
