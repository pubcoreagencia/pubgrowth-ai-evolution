
# Auditoria: Integração Banco Inter PIX no Cloudflare Pages/Workers

## Diagnóstico honesto (verificado no código atual)

Analisei `src/lib/payment-provider/inter-pix.server.ts`, `src/routes/api/public/webhooks/inter-pix.ts`, `src/server.ts` e a configuração do runtime. Resposta objetiva às suas perguntas:

### 1. A integração está 100% compatível com Cloudflare Workers?
**Não.** O ponto crítico é o mTLS. Hoje o cliente usa:

```ts
const { Agent } = await import("undici");
new Agent({ connect: { cert, key } });
// undici.fetch com { dispatcher }
```

`undici.Agent` é Node-only. No Workers runtime (mesmo com `nodejs_compat`), `undici` com dispatcher customizado e sockets TLS crus **não funciona** — a knowledge do próprio runtime lista `undici` desse jeito como não suportado. Vai falhar em produção com `[unenv] ... not implemented` ou erro de rede.

### 2. Usa recursos exclusivos Node.js?
Sim: `undici.Agent`, `connect: { cert, key }` (TLS socket manual), dispatcher customizado no `fetch`. Não usa `fs` nem arquivos locais (certificado já vem de env var, isso está correto).

### 3. Webhook funciona no Cloudflare?
**Sim.** `src/routes/api/public/webhooks/inter-pix.ts` é 100% compatível — só usa `Request`/`Response`, `request.json()` e o `supabaseAdmin` (via `fetch`). Nenhum ajuste necessário.

### 4. Renovação do Access Token é segura em serverless?
**Parcialmente.** O `cachedToken` é uma variável de módulo — no Workers cada isolate tem seu próprio cache, então funciona (reduz chamadas), mas não é compartilhado entre isolates. Não é inseguro, só sub-ótimo. Aceitável em MVP; ideal seria persistir em KV/Supabase para reuso global.

### 5. Certificado carregado via Secret?
**Sim, já correto.** `INTER_CERT_PEM` e `INTER_KEY_PEM` vêm de `process.env`, sem leitura de arquivo. Isso está OK.

### 6. Existe algo que impede o deploy em produção?
**Sim: o mTLS via `undici.Agent`.** É o único bloqueador real. Sem isso, todas as chamadas à API do Inter falharão em produção no Cloudflare.

---

## Como o Cloudflare exige mTLS

Workers **não permitem** apresentar certificado cliente a partir de PEM em código. A única forma suportada é:
1. Fazer upload do cert+key para Cloudflare (`wrangler mtls-certificate upload`).
2. Declarar um binding `mtls_certificates` no `wrangler.toml`.
3. Chamar `env.INTER_MTLS.fetch(url, init)` — o binding injeta o cert no handshake.

Isso funciona, mas exige: (a) acesso ao painel Cloudflare pra fazer upload do cert, (b) configurar binding no wrangler, (c) o binding não é acessível pelas Secrets padrão do Lovable Cloud — precisa de configuração manual no projeto Cloudflare após o deploy.

**Importante:** o template atual do Lovable roda em Workers gerenciados pela Lovable. O binding `mtls_certificates` **não está exposto** hoje pela plataforma Lovable — você não consegue fazer upload de cert cliente pelo painel do Lovable. Isso é uma limitação da plataforma, não do código.

---

## Arquitetura recomendada (a única que funciona hoje)

Como o Lovable Workers não expõe binding mTLS e o Inter **exige mTLS obrigatoriamente** em toda chamada da API PIX, você tem três caminhos reais:

### Opção A — Proxy mTLS externo (recomendado, menos fricção)
Colocar um pequeno serviço em Node (Fly.io, Render, Railway, VPS, ou uma Cloudflare Worker separada que você mesmo faz deploy com `wrangler` e binding mTLS) que:
- Recebe requisições HTTPS autenticadas por bearer (secret compartilhado).
- Repassa ao Inter com o cert mTLS.
- Retorna a resposta.

O Lovable/Workers chama esse proxy via `fetch` normal. Zero mTLS no código Lovable.

### Opção B — Deploy próprio no Cloudflare com binding mTLS
Você exporta o projeto Lovable, faz deploy manual via `wrangler` com `mtls_certificates` binding configurado. Requer sair do fluxo gerenciado do Lovable e manter deploy próprio.

### Opção C — Hospedar em runtime Node (não Cloudflare)
Fly.io / Render / Railway rodam Node nativo — o código atual com `undici.Agent` funciona sem mudança. Perde vantagens de edge do Cloudflare, mas é o caminho de menor esforço se você já quer sair do Lovable-hosted.

---

## Plano de execução (após aprovação)

Preciso da sua decisão entre A, B ou C antes de mexer no código. Cada uma leva a mudanças diferentes:

- **Se A (proxy externo):** refatoro `inter-pix.server.ts` para chamar `INTER_PROXY_URL` via `fetch` padrão com header `Authorization: Bearer ${INTER_PROXY_SECRET}`. Remove `undici`. Adiciono 2 secrets novas. Entrego também o código do proxy (pequeno, ~50 linhas Node) pronto pra você fazer deploy em Fly/Render.
- **Se B (deploy próprio Cloudflare):** refatoro `inter-pix.server.ts` para usar `env.INTER_MTLS.fetch(...)` via getRequest context, documento `wrangler.toml` com binding, e instruções de upload de cert. Você assume o deploy.
- **Se C (Node host):** mantém o código como está, só documenta o host correto. Zero mudança de código.

Também nas 3 opções:
- Deixo comentário/erro claro se `INTER_ENV=production` sem provider configurado.
- Webhook fica como está (já compatível).
- Cache de token permanece em memória (adequado ao caso).

---

## Relatório final resumido

| Item | Status atual | Precisa mudar? |
|---|---|---|
| Webhook (`/api/public/webhooks/inter-pix`) | Compatível Workers | Não |
| Cert/key via env vars (sem fs) | Correto | Não |
| Cache de access token | Funciona por isolate | Não (aceitável) |
| Chamadas OAuth + PIX com mTLS via `undici.Agent` | **Incompatível Workers** | **Sim — bloqueador** |
| `src/server.ts`, rotas, DB | Compatível | Não |

**Veredito:** o webhook e toda a camada de dados/RLS estão prontos para Cloudflare. O único ponto que **impede o deploy em produção no Cloudflare Pages/Workers** é o cliente mTLS. Como o Lovable-hosted Workers não expõe binding mTLS hoje, minha recomendação técnica é **Opção A (proxy mTLS externo)** — mantém você no Cloudflare/Lovable, isola o único pedaço Node-only num serviço mínimo, e é reversível se amanhã o Lovable expor bindings mTLS.

**Qual opção você aprova (A, B ou C)?** Só depois disso eu mexo no código.
