# Checklist de Handoff

Use este checklist ao passar o projeto para outra maquina, outra IA ou outro desenvolvedor.

## Auditoria Inicial

```powershell
git status
git branch --show-current
git remote -v
git log --oneline -5
git ls-files .env
git ls-files .env.example
git ls-files docs
```

## Esperado

- remote `origin` aponta para `https://github.com/pubcoreagencia/pubgrowth-ai-evolution.git`;
- branch principal: `main`;
- `.env` nao aparece em `git ls-files`;
- `.env.example` aparece em `git ls-files`;
- docs de setup e seguranca existem.

## Antes de Codar

1. Ler `README.md`.
2. Ler `docs/SETUP.md`.
3. Ler `docs/SECURITY.md`.
4. Ler `docs/PROJECT_STATUS.md`.
5. Confirmar com o responsavel se a tarefa permite:
   - alteracao de banco;
   - deploy;
   - alteracao de secrets;
   - alteracao Banco Inter.

## Antes de Commitar

```powershell
npm.cmd exec -- eslint .
npm.cmd run build
git status
git diff --cached --name-only
```

Nunca commitar `.env`, `.dev.vars`, certificados ou dumps de banco.

## Antes de Deploy

Deploy precisa de autorizacao explicita.

Checklist minimo:

- build local passou;
- mudancas revisadas;
- nenhuma secret no diff;
- ambiente alvo confirmado;
- `INTER_ENV` confirmado;
- Cloudflare bindings confirmados.
