# PubGrowth AI

PubGrowth AI is a SaaS platform for agency-managed growth campaigns, client portfolios, wallet balance, client portal access, and PIX recharge through Banco Inter.

## Current Production

- Repository: `pubcoreagencia/pubgrowth-ai-evolution`
- Production URL: `https://pubgrowthai.contato-pubcore.workers.dev`
- Supabase project ref: `rjhnfztjikifymxupagb`
- Runtime: Cloudflare Workers
- PIX environment: `sandbox`
- Important Cloudflare bindings: `INTER_TOKEN_CACHE`, `INTER_MTLS`

## Stack

- TanStack Start
- Vite
- Nitro
- React
- Supabase Auth/Postgres/RLS
- Cloudflare Workers, KV, mTLS
- Banco Inter PIX

## Start Here

Read these documents before changing code:

1. `docs/SETUP.md` - clone/setup checklist for another machine.
2. `docs/SECURITY.md` - secrets, token, and deployment safety rules.
3. `docs/PROJECT_STATUS.md` - current product status and known pending work.
4. `docs/DEPLOY_CLOUDFLARE.md` - Cloudflare deploy and Banco Inter infrastructure.
5. `docs/MASTER_CONTEXT.md` - historical context and product architecture.

## Local Commands

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd exec -- eslint .
npm.cmd run build
```

## Non-Negotiable Safety Rules

- Do not print real secrets, tokens, cookies, localStorage, certificates, private keys, Supabase service role keys, or Banco Inter credentials.
- Do not deploy, change Cloudflare secrets, change Banco Inter config, alter the remote database, or run migrations without explicit authorization.
- Do not force push, rebase, amend, or rewrite published history.
- Keep `.env` local only. Use `.env.example` as the template.
