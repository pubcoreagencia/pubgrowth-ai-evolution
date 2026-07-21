// Banco Inter PJ — Pix Cob API client (Cloudflare Workers nativo, mTLS via binding).
//
// Arquitetura:
//   - mTLS: binding `INTER_MTLS` (mtls_certificates) declarado no wrangler.toml.
//     Uploaded uma única vez via `wrangler mtls-certificate upload`.
//   - OAuth token cache: KV binding `INTER_TOKEN_CACHE` (compartilhado entre
//     isolates, seguro para serverless). Fallback em memória (mesmo isolate).
//   - Nenhuma dependência de Node APIs (`undici`, `https`, `tls`, `fs`).
//     100% Web Platform (`fetch`, `URLSearchParams`, `Headers`).
//
// Troca sandbox <-> produção: alterar somente a secret INTER_ENV e (re)uploadar
// o certificado correspondente. Nenhum código muda.

import type { CreatePixChargeInput, PaymentProvider, PixCharge } from "./types";

type InterEnv = "sandbox" | "production";

interface InterBindings {
  INTER_MTLS: Fetcher;
  INTER_TOKEN_CACHE?: KVNamespace;
}

// Fallback in-memory cache (per isolate). KV é a fonte primária.
let memToken: { value: string; expiresAt: number; env: InterEnv } | null = null;

function getEnv(): InterEnv {
  const e = (process.env.INTER_ENV ?? "sandbox").toLowerCase();
  return e === "production" ? "production" : "sandbox";
}

function baseUrl(env: InterEnv): string {
  return env === "production"
    ? "https://cdpj.partners.bancointer.com.br"
    : "https://cdpj-sandbox.partners.uatinter.co";
}

async function getBindings(): Promise<InterBindings> {
  // `cloudflare:workers` só existe em runtime workerd. Import dinâmico para
  // não quebrar tipos/build fora do Worker.
  try {
    const mod = (await import(/* @vite-ignore */ "cloudflare:workers")) as unknown as {
      env: Partial<InterBindings>;
    };
    if (!mod?.env?.INTER_MTLS) {
      throw new Error("Binding INTER_MTLS ausente (verifique wrangler.toml).");
    }
    return mod.env as InterBindings;
  } catch (err) {
    throw new Error(
      "Este código só executa no Cloudflare Workers (binding mTLS obrigatório). " +
        `Detalhe: ${(err as Error).message}`,
    );
  }
}

// AbortSignal.timeout equivalente compatível com Workers.
function withTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

async function readCachedToken(env: InterEnv, kv?: KVNamespace): Promise<string | null> {
  const now = Date.now();
  if (memToken && memToken.env === env && memToken.expiresAt - 30_000 > now) {
    return memToken.value;
  }
  if (kv) {
    const raw = await kv.get(`inter:token:${env}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { value: string; expiresAt: number };
        if (parsed.expiresAt - 30_000 > now) {
          memToken = { ...parsed, env };
          return parsed.value;
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return null;
}

async function writeCachedToken(
  env: InterEnv,
  value: string,
  ttlSeconds: number,
  kv?: KVNamespace,
): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  memToken = { value, expiresAt, env };
  if (kv) {
    // TTL mínimo do KV é 60s.
    const kvTtl = Math.max(60, ttlSeconds - 30);
    await kv.put(`inter:token:${env}`, JSON.stringify({ value, expiresAt }), {
      expirationTtl: kvTtl,
    });
  }
}

async function getAccessToken(bindings: InterBindings): Promise<string> {
  const env = getEnv();
  const cached = await readCachedToken(env, bindings.INTER_TOKEN_CACHE);
  if (cached) return cached;

  const clientId = process.env.INTER_CLIENT_ID;
  const clientSecret = process.env.INTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("INTER_CLIENT_ID / INTER_CLIENT_SECRET não configurados.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "cob.write cob.read pix.read webhook.write webhook.read",
    grant_type: "client_credentials",
  }).toString();

  const res = await bindings.INTER_MTLS.fetch(`${baseUrl(env)}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: withTimeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    // Nunca loga client_id/secret; apenas status + trecho da resposta.
    throw new Error(`Falha no OAuth Inter (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  await writeCachedToken(env, json.access_token, json.expires_in, bindings.INTER_TOKEN_CACHE);
  return json.access_token;
}

function toCurrency(amount: number): string {
  return amount.toFixed(2);
}

export const interPixProvider: PaymentProvider = {
  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
    const pixKey = process.env.INTER_PIX_KEY;
    if (!pixKey) throw new Error("INTER_PIX_KEY não configurada.");

    const bindings = await getBindings();
    const env = getEnv();
    const token = await getAccessToken(bindings);
    const expiresIn = input.expiresIn ?? 3600;

    const payload: Record<string, unknown> = {
      calendario: { expiracao: expiresIn },
      valor: { original: toCurrency(input.amount) },
      chave: pixKey,
      solicitacaoPagador: input.description?.slice(0, 140) ?? "Recarga PubGrowth AI",
    };
    if (input.payerName && input.payerDoc) {
      const doc = input.payerDoc.replace(/\D/g, "");
      payload.devedor =
        doc.length === 14
          ? { cnpj: doc, nome: input.payerName }
          : { cpf: doc, nome: input.payerName };
    }

    const cobUrl = `${baseUrl(env)}/pix/v2/cob/${encodeURIComponent(input.txid)}`;
    const res = await bindings.INTER_MTLS.fetch(cobUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: withTimeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha ao criar cobrança PIX Inter (${res.status}): ${text.slice(0, 500)}`);
    }
    const cob = (await res.json()) as {
      txid: string;
      loc?: { id: number };
      pixCopiaECola?: string;
      calendario?: { criacao: string; expiracao: number };
    };

    let qrcodeBase64 = "";
    if (cob.loc?.id) {
      const qrUrl = `${baseUrl(env)}/pix/v2/loc/${cob.loc.id}/qrcode`;
      const qrRes = await bindings.INTER_MTLS.fetch(qrUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: withTimeout(15_000),
      });
      if (qrRes.ok) {
        const qrJson = (await qrRes.json()) as { qrcode?: string; imagemQrcode?: string };
        qrcodeBase64 = qrJson.imagemQrcode ?? qrJson.qrcode ?? "";
      }
    }

    const criacao = cob.calendario?.criacao ? new Date(cob.calendario.criacao) : new Date();
    const expiresAt = new Date(criacao.getTime() + expiresIn * 1000).toISOString();

    return {
      txid: cob.txid,
      externalId: String(cob.loc?.id ?? cob.txid),
      qrcodeBase64,
      copyPaste: cob.pixCopiaECola ?? "",
      expiresAt,
    };
  },
};