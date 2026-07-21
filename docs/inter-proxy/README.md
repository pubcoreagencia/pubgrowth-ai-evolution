# Proxy mTLS Banco Inter — deploy externo

Este proxy é o único componente do PubGrowth AI que **não** roda no
Cloudflare Workers. Ele existe porque a API PIX do Banco Inter exige
mTLS (certificado cliente) em toda chamada, e Workers gerenciados pela
Lovable não expõem hoje o binding `mtls_certificates` da Cloudflare.

O proxy recebe requisições HTTPS autenticadas por um bearer compartilhado,
apresenta o certificado do Inter no handshake TLS, e devolve a resposta
bruta.

## Onde hospedar

Qualquer runtime Node 18+ com saída HTTPS irrestrita serve. Opções
testadas:

- **Fly.io** — plano hobby serve; `fly launch` a partir desta pasta.
- **Render** — Web Service, build `npm i`, start `node server.js`.
- **Railway** — deploy direto do repositório.
- **VPS** próprio com `pm2`/systemd.

Não use serverless Node (Vercel Functions, AWS Lambda default) — cada
cold start recompila o contexto TLS.

## Variáveis de ambiente do proxy

| Nome | Descrição |
|---|---|
| `INTER_PROXY_SECRET` | Mesmo valor salvo no Lovable como `INTER_PROXY_SECRET`. Bearer obrigatório. |
| `INTER_CERT_PEM` | Certificado cliente do Inter (PEM completo, inclusive header/footer). |
| `INTER_KEY_PEM` | Chave privada do certificado. |
| `PORT` | Opcional (default 8080). |

Rode com `node server.js`. Endpoints expostos:

- `POST /oauth/v2/token`
- `PUT  /pix/v2/cob/:txid`
- `GET  /pix/v2/loc/:id/qrcode`
- qualquer outro caminho é repassado.

O header `X-Inter-Env: production|sandbox` escolhe o host do Inter.
O header `X-Inter-Token: <access_token>` (quando presente) é reencaminhado
como `Authorization: Bearer` para o Inter.

## Depois do deploy

No Lovable, salve dois secrets:

- `INTER_PROXY_URL` = URL pública do proxy (ex.: `https://inter-proxy.fly.dev`).
- `INTER_PROXY_SECRET` = mesmo valor configurado no proxy.

Pronto. O código em `src/lib/payment-provider/inter-pix.server.ts` já usa
esses secrets automaticamente.