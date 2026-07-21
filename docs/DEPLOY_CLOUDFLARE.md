# Deploy self-hosted no Cloudflare Workers

Este documento assume que você usa apenas suas próprias contas:
**GitHub**, **Cloudflare**, **Supabase** e **Banco Inter PJ**. Não há
dependência da plataforma Lovable em runtime.

## 1. Pré-requisitos

- Conta Cloudflare (plano Free basta — `mtls_certificates` está incluso).
- Domínio opcional em Cloudflare (para custom domain).
- Certificado + chave privada do Banco Inter (`cert.pem`, `key.pem`)
  gerados na área do desenvolvedor do Inter.
- Credenciais Supabase do seu projeto.
- `bun` e `wrangler` locais:
  ```bash
  npm i -g wrangler
  curl -fsSL https://bun.sh/install | bash
  ```

## 2. Setup inicial (uma vez por ambiente)

```bash
# Login na sua conta Cloudflare
wrangler login

# Upload do certificado mTLS do Inter (sandbox OU produção)
wrangler mtls-certificate upload \
  --cert ./cert.pem \
  --key ./key.pem \
  --name inter-pix-sandbox
# -> retorna certificate_id. Copie para wrangler.toml em [[mtls_certificates]].

# Criar KV namespace para cache do access_token OAuth
wrangler kv namespace create INTER_TOKEN_CACHE
# -> retorna id. Copie para wrangler.toml em [[kv_namespaces]].
```

Edite `wrangler.toml` substituindo `REPLACE_WITH_CERT_ID` e
`REPLACE_WITH_KV_ID` pelos valores retornados.

## 3. Secrets

```bash
# Banco Inter
wrangler secret put INTER_CLIENT_ID
wrangler secret put INTER_CLIENT_SECRET
wrangler secret put INTER_PIX_KEY
wrangler secret put INTER_WEBHOOK_SECRET

# Supabase
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_PUBLISHABLE_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

`INTER_ENV` está em `[vars]` no `wrangler.toml` (não é secret).

## 4. Deploy manual

```bash
bun install
bun run build
wrangler deploy
```

## 5. Deploy automatizado via GitHub Actions

O workflow `.github/workflows/deploy.yml` já está configurado. No repositório
GitHub, adicione dois secrets:

- `CLOUDFLARE_API_TOKEN` — crie em Cloudflare Dashboard → My Profile → API
  Tokens → template "Edit Cloudflare Workers".
- `CLOUDFLARE_ACCOUNT_ID` — visível no dashboard da conta.

Todo push em `main` publica automaticamente.

## 6. Configuração do webhook no Inter

No portal do Banco Inter, configure o webhook para:

```
https://<seu-worker>.workers.dev/api/public/webhooks/inter-pix?secret=<INTER_WEBHOOK_SECRET>
```

Ou use header `x-webhook-secret`. O secret protege contra chamadas não
autorizadas — o Inter também apresenta mTLS na chamada (você não precisa
validar o mTLS reverso no Worker; a URL + secret bastam).

## 7. Troca Sandbox → Produção

Zero alteração de código. Sequência:

```bash
# 1. Upload do certificado de produção
wrangler mtls-certificate upload \
  --cert ./cert-prod.pem --key ./key-prod.pem \
  --name inter-pix-prod

# 2. Atualize wrangler.toml: certificate_id -> novo id de produção
#    e vars.INTER_ENV = "production"

# 3. Atualize as secrets de credencial (se o Inter emitiu novas)
wrangler secret put INTER_CLIENT_ID
wrangler secret put INTER_CLIENT_SECRET
wrangler secret put INTER_PIX_KEY

# 4. Redeploy
wrangler deploy
```

## 8. Rotação/atualização futura do certificado

```bash
# Upload da nova versão
wrangler mtls-certificate upload --cert new.pem --key new.key --name inter-pix-v2
# -> pegue o novo certificate_id, atualize wrangler.toml, wrangler deploy

# Após confirmar produção estável, remova o antigo:
wrangler mtls-certificate delete <old-cert-id>
```

## 9. Observabilidade

`observability.enabled = true` no `wrangler.toml` liga logs no dashboard.
Para tail em tempo real:

```bash
wrangler tail
```

## 10. Checklist final

- [ ] `wrangler.toml` com `certificate_id` e KV `id` reais.
- [ ] Todas as secrets do passo 3 configuradas via `wrangler secret put`.
- [ ] Webhook do Inter apontando para o Worker publicado.
- [ ] `INTER_ENV` correto (`sandbox` ou `production`).
- [ ] GitHub Secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` (se
      usar CI).