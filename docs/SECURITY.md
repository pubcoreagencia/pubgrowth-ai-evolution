# Seguranca de Secrets

## Regra Principal

Nunca imprimir, commitar, colar ou documentar valores reais de:

- Supabase service role key;
- Supabase publishable key se o contexto puder expor ambiente privado;
- tokens de acesso ou refresh;
- cookies;
- localStorage completo;
- Cloudflare API token;
- Banco Inter client id/client secret;
- Banco Inter PIX key;
- Banco Inter webhook secret;
- certificados, chaves privadas, PEM, PFX ou senha de certificado;
- payloads sensiveis de webhook.

## Arquivos Locais

- `.env` deve existir apenas localmente.
- `.env.example` deve conter somente placeholders.
- `.dev.vars` tambem deve ser local.
- Certificados do Banco Inter nunca devem entrar no repo.

## Git

Antes de commitar:

```powershell
git status
git diff --cached --name-only
git ls-files .env
git ls-files .dev.vars
```

Resultados seguros:

- `git ls-files .env` vazio;
- `git ls-files .dev.vars` vazio.

Se `.env` aparecer rastreado:

```powershell
git rm --cached .env
```

Nao use force push, rebase, amend ou squash em historico ja publicado.

## Logs Seguros

Logs permitidos:

- status HTTP;
- nome da etapa (`OAuth`, `criacao da cobranca PIX`, `webhook`);
- se uma sessao existe ou nao;
- se um header existe ou nao;
- codigo de erro do banco;
- mensagem higienizada sem credenciais.

Logs proibidos:

- token Bearer;
- cookies;
- refresh token;
- `localStorage`;
- secrets Cloudflare;
- service role key;
- request/response completo do Banco Inter;
- certificado ou chave privada.

## Rotacao

Se algum segredo for exposto:

1. revogar/rotacionar no provedor;
2. atualizar Cloudflare/GitHub/Supabase conforme aplicavel;
3. invalidar sessoes se tokens de usuario foram expostos;
4. limpar o historico somente com um plano aprovado pelo responsavel, evitando reescrever historico Lovable sem necessidade.
