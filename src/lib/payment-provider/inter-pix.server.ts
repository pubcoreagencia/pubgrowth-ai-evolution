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

type JsonSafe =
  | string
  | number
  | boolean
  | null
  | JsonSafe[]
  | { [key: string]: JsonSafe };

const tokenCacheVersion = "v2";

// Fallback in-memory cache (per isolate). KV é a fonte primária.
let memToken: { value: string; expiresAt: number; env: InterEnv } | null = null;

function getEnv(): InterEnv {
  const e = normalizeEnvValue(process.env.INTER_ENV ?? "sandbox").toLowerCase();
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
function normalizeEnvValue(value: string | undefined): string {
  let normalized = value?.replace(/^\uFEFF/, "").trim() ?? "";
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function getRequiredEnv(name: string): string {
  const value = normalizeEnvValue(process.env[name]);
  if (!value) throw new Error(`${name} nao configurado.`);
  return value;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && /aborted/i.test(error.message))
  );
}

function interTimeoutMessage(env: InterEnv, label: string): string {
  if (env === "sandbox") {
    return (
      `Banco Inter sandbox nao respondeu a tempo (${label}). ` +
      "O ambiente de testes pode estar fora da janela operacional. " +
      "Tente novamente dentro do horario de homologacao informado pelo Inter."
    );
  }

  return `Banco Inter nao respondeu a tempo (${label}). Tente novamente em alguns instantes.`;
}

async function interFetch(
  bindings: InterBindings,
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs = 12_000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await bindings.INTER_MTLS.fetch(url, { ...init, signal: ctrl.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(interTimeoutMessage(getEnv(), label));
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha de comunicacao com Banco Inter (${label}): ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function readCachedToken(env: InterEnv, kv?: KVNamespace): Promise<string | null> {
  const now = Date.now();
  if (memToken && memToken.env === env && memToken.expiresAt - 30_000 > now) {
    return memToken.value;
  }
  if (kv) {
    const raw = await kv.get(`inter:token:${env}:${tokenCacheVersion}`);
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
    await kv.put(`inter:token:${env}:${tokenCacheVersion}`, JSON.stringify({ value, expiresAt }), {
      expirationTtl: kvTtl,
    });
  }
}

async function getAccessToken(bindings: InterBindings): Promise<string> {
  const env = getEnv();
  const cached = await readCachedToken(env, bindings.INTER_TOKEN_CACHE);
  if (cached) return cached;

  const clientId = getRequiredEnv("INTER_CLIENT_ID");
  const clientSecret = getRequiredEnv("INTER_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "cob.write cob.read pix.write pix.read webhook.write webhook.read",
    grant_type: "client_credentials",
  }).toString();

  const res = await interFetch(
    bindings,
    `${baseUrl(env)}/oauth/v2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    "OAuth",
  );
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

function toPaymentAmount(amount: number): string {
  return amount.toFixed(2);
}

function sanitizeProviderValue(value: unknown, key = ""): JsonSafe {
  const normalizedKey = key.toLowerCase();
  if (
    [
      "authorization",
      "access_token",
      "token",
      "client_id",
      "client_secret",
      "chave",
      "cpf",
      "cnpj",
    ].includes(normalizedKey)
  ) {
    return "[redacted]";
  }

  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 4000 ? `${value.slice(0, 4000)}...[truncated]` : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProviderValue(item));
  }

  if (typeof value === "object") {
    const out: { [key: string]: JsonSafe } = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = sanitizeProviderValue(childValue, childKey);
    }
    return out;
  }

  return String(value);
}

export async function paySandboxPixCharge(input: {
  txid: string;
  amount: number;
  copyPaste?: string | null;
}): Promise<JsonSafe> {
  const env = getEnv();
  if (env !== "sandbox") {
    throw new Error("A simulacao de pagamento PIX so pode ser usada no ambiente sandbox.");
  }

  const amount = toPaymentAmount(input.amount);
  const bindings = await getBindings();
  const token = await getAccessToken(bindings);

  const txidAttempt = await requestSandboxPayment(
    bindings,
    env,
    token,
    `${baseUrl(env)}/pix/v2/cob/pagar/${encodeURIComponent(input.txid)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ valor: amount }),
    },
    "pagar por txid",
  );

  if (txidAttempt.ok) {
    console.info("[inter-pix] Sandbox Pix payment simulation", txidAttempt.providerResponse);
    return txidAttempt.providerResponse;
  }

  let qrAttempt: Awaited<ReturnType<typeof requestSandboxPayment>> | null = null;
  if (input.copyPaste) {
    qrAttempt = await requestSandboxPayment(
      bindings,
      env,
      token,
      `${baseUrl(env)}/pix/v2/sandbox/cob/pagamento`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qrCode: input.copyPaste, valor: input.amount }),
      },
      "pagar por pix copia e cola",
    );
    if (qrAttempt.ok) {
      const providerResponse = sanitizeProviderValue({
        env,
        txid: input.txid,
        amount,
        attempts: {
          txid: txidAttempt.providerResponse,
          qrCode: qrAttempt.providerResponse,
        },
      });
      console.info("[inter-pix] Sandbox Pix payment simulation", providerResponse);
      return providerResponse;
    }
  }

  const providerResponse = sanitizeProviderValue({
    env,
    txid: input.txid,
    amount,
    attempts: {
      txid: txidAttempt.providerResponse,
      qrCode: qrAttempt?.providerResponse ?? null,
    },
  });

  console.warn("[inter-pix] Sandbox Pix payment simulation failed", providerResponse);
  const error = new Error(
    `Falha ao simular pagamento PIX sandbox. ` +
      `TXID: ${txidAttempt.status} ${txidAttempt.text.slice(0, 300)} ` +
      (qrAttempt ? `QRCode: ${qrAttempt.status} ${qrAttempt.text.slice(0, 300)}` : ""),
  );
  (error as Error & { providerResponse?: JsonSafe }).providerResponse = providerResponse;
  throw error;
}

async function requestSandboxPayment(
  bindings: InterBindings,
  env: InterEnv,
  token: string,
  url: string,
  init: RequestInit,
  method: string,
): Promise<{ ok: boolean; status: number; text: string; providerResponse: JsonSafe }> {
  const res = await interFetch(bindings, url, init, `simulacao sandbox (${method})`);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    ok: res.ok,
    status: res.status,
    text,
    providerResponse: sanitizeProviderValue({
      env,
      method,
      ok: res.ok,
      status: res.status,
      request: {
        url,
        body: init.body,
        authorization: token,
      },
      body,
    }),
  };
}

export const interPixProvider: PaymentProvider = {
  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
    const pixKey = getRequiredEnv("INTER_PIX_KEY");

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
    const res = await interFetch(
      bindings,
      cobUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
      "criacao da cobranca PIX",
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha ao criar cobrança PIX Inter (${res.status}): ${text.slice(0, 500)}`);
    }
    const cob = (await res.json()) as {
      txid: string;
      loc?: { id: number };
      pixCopiaECola?: string;
      calendario?: { criacao: string; expiracao: number };
      status?: string;
    };

    let qrcodeBase64 = "";
    let qrProviderResponse: JsonSafe | null = null;
    if (cob.loc?.id) {
      const qrUrl = `${baseUrl(env)}/pix/v2/loc/${cob.loc.id}/qrcode`;
      try {
        const qrRes = await interFetch(
          bindings,
          qrUrl,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          },
          "QR Code PIX",
          8_000,
        );
        if (qrRes.ok) {
          const qrJson = (await qrRes.json()) as { qrcode?: string; imagemQrcode?: string };
          qrProviderResponse = sanitizeProviderValue(qrJson);
          qrcodeBase64 = qrJson.imagemQrcode ?? qrJson.qrcode ?? "";
        } else {
          const text = await qrRes.text();
          qrProviderResponse = sanitizeProviderValue({
            ok: false,
            status: qrRes.status,
            body: text.slice(0, 1000),
          });
          console.warn("[inter-pix] QR Code request failed", qrProviderResponse);
        }
      } catch (error) {
        qrProviderResponse = sanitizeProviderValue({
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        });
        console.warn("[inter-pix] QR Code request skipped", qrProviderResponse);
      }
    }

    const criacao = cob.calendario?.criacao ? new Date(cob.calendario.criacao) : new Date();
    const expiresAt = new Date(criacao.getTime() + expiresIn * 1000).toISOString();
    const providerResponse = sanitizeProviderValue({
      env,
      charge: cob,
      qrcode: qrProviderResponse,
    });

    console.info("[inter-pix] Pix charge created", {
      txid: cob.txid,
      amount: input.amount,
      status: cob.status ?? "pending",
      pixCopyPaste: cob.pixCopiaECola ?? "",
      providerResponse,
    });

    return {
      txid: cob.txid,
      externalId: String(cob.loc?.id ?? cob.txid),
      qrcodeBase64,
      copyPaste: cob.pixCopiaECola ?? "",
      expiresAt,
      providerResponse,
    };
  },
};
