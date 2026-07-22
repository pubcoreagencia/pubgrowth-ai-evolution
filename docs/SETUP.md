# Setup em Outra Maquina

Este checklist deixa o projeto continuavel sem expor secrets.

## 1. Clonar

```powershell
git clone https://github.com/pubcoreagencia/pubgrowth-ai-evolution.git
cd pubgrowth-ai-evolution
git status
git branch --show-current
```

Branch padrao esperada: `main`.

## 2. Instalar dependencias

```powershell
npm.cmd install
```

## 3. Criar `.env`

```powershell
Copy-Item .env.example .env
```

Preencha `.env` manualmente com valores reais obtidos nos dashboards corretos. Nao cole esses valores em chat, issue, commit, log, print ou documento.

Supabase correto:

```text
rjhnfztjikifymxupagb
```

## 4. Validar setup local

```powershell
npm.cmd exec -- eslint .
npm.cmd run build
```

Para desenvolvimento:

```powershell
npm.cmd run dev
```

## 5. Supabase

O projeto correto e `rjhnfztjikifymxupagb`.

Antes de rodar qualquer migration remota:

1. confirmar que o Supabase CLI esta logado na conta correta;
2. confirmar o `project_id` em `supabase/config.toml`;
3. confirmar com o responsavel se migrations remotas estao autorizadas;
4. fazer backup/export se houver dados de producao relevantes.

Comando tipico, somente com autorizacao:

```powershell
npx supabase link --project-ref rjhnfztjikifymxupagb
npx supabase db push
```

## 6. Cloudflare

O Worker usa:

- `INTER_TOKEN_CACHE` como KV de cache OAuth Banco Inter;
- `INTER_MTLS` como binding mTLS para o certificado Banco Inter;
- secrets Cloudflare para Supabase e Banco Inter.

Nao rode deploy sem autorizacao explicita.

Comando de deploy, somente quando autorizado:

```powershell
npm.cmd run build
npm.cmd exec -- wrangler deploy
```

## 7. Banco Inter

O ambiente atual e `sandbox`. O sandbox pode ter janela operacional limitada; se OAuth ou PIX demorarem muito fora do horario informado pelo Inter, teste novamente em horario comercial.

Nao altere `INTER_ENV`, certificado mTLS, credenciais, chave PIX ou webhook sem autorizacao.
