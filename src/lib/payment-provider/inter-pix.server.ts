// Inter Bank PJ — Pix Cob API client (server-only).
//
// Requires mTLS. On Node/undici this works out of the box; on Cloudflare
// Workers you need an mTLS certificate binding (Cloudflare Zero Trust /
// `mtls_certificates`). If the runtime doesn't support client certs, the
// call will fail with a network error — surface it to the operator and
// configure a proxy or binding.

import type { CreatePixChargeInput, PaymentProvider, PixCharge } from "./types";

const BASE_URLS = {
  sandbox: "https://cdpj-sandbox.partners.uatinter.co",
  production: "https://cdpj.partners.bancointer.com.br",
} as const;

type Env = keyof typeof BASE_URLS;

let cachedToken: { value: string; expiresAt: number } | null = null;

function getEnv(): Env {
  const e = (process.env.INTER_ENV ?? "sandbox").toLowerCase();
  return e === "production" ? "production" : "sandbox";
}

async function getDispatcher() {
  // Load undici lazily; only available on Node-compatible runtime.
  const { Agent } = await import("undici");
  const cert = process.env.INTER_CERT_PEM;
  const key = process.env.INTER_KEY_PEM;
  if (!cert || !key) {
    throw new Error("Certificado mTLS Inter (INTER_CERT_PEM / INTER_KEY_PEM) não configurado.");
  }
  return new Agent({ connect: { cert, key } });
}

async function interFetch(path: string, init: RequestInit & { body?: string } = {}) {
  const base = BASE_URLS[getEnv()];
  const dispatcher = await getDispatcher();
  // undici's fetch accepts a `dispatcher` option; TS types don't include it.
  const { fetch: undiciFetch } = await import("undici");
  const res = await (undiciFetch as unknown as typeof fetch)(base + path, {
    ...init,
    // @ts-expect-error - undici extension
    dispatcher,
  });
  return res;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 30_000 > now) return cachedToken.value;

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

  const res = await interFetch("/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha no OAuth Inter (${res.status}): ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

function toCurrency(amount: number): string {
  return amount.toFixed(2);
}

export const interPixProvider: PaymentProvider = {
  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
    const pixKey = process.env.INTER_PIX_KEY;
    if (!pixKey) throw new Error("INTER_PIX_KEY não configurada.");

    const token = await getAccessToken();
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

    const res = await interFetch(`/pix/v2/cob/${encodeURIComponent(input.txid)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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

    // Fetch QR code image for the loc
    let qrcodeBase64 = "";
    if (cob.loc?.id) {
      const qrRes = await interFetch(`/pix/v2/loc/${cob.loc.id}/qrcode`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
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