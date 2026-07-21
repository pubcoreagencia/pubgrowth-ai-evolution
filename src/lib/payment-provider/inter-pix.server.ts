// Inter Bank PJ — Pix Cob API client (server-only, Cloudflare Workers compatible).
//
// mTLS obrigatório da API do Inter é feito por um PROXY externo em Node
// (Fly.io / Render / Railway / Worker próprio com binding mtls_certificates).
// Este módulo apenas fala HTTP normal com o proxy, autenticando via bearer.
//
// Contrato esperado do proxy (mínimo):
//   POST {INTER_PROXY_URL}/oauth/v2/token
//     Header: Authorization: Bearer {INTER_PROXY_SECRET}
//     Body:  application/x-www-form-urlencoded (repassado ao Inter)
//     Resp:  JSON do Inter { access_token, expires_in, ... }
//
//   PUT {INTER_PROXY_URL}/pix/v2/cob/{txid}
//     Header: Authorization: Bearer {INTER_PROXY_SECRET}
//            X-Inter-Token: {access_token do Inter}
//     Body:  JSON repassado ao Inter
//     Resp:  JSON do Inter
//
//   GET {INTER_PROXY_URL}/pix/v2/loc/{id}/qrcode
//     Header: Authorization: Bearer {INTER_PROXY_SECRET}
//            X-Inter-Token: {access_token do Inter}
//     Resp:  JSON do Inter { imagemQrcode, qrcode }
//
// O proxy é responsável por: (a) apresentar o cert cliente ao Inter,
// (b) escolher sandbox vs produção via header/rota, (c) proteger o
// endpoint com o bearer compartilhado. Referência: ver docs/inter-proxy.md.

import type { CreatePixChargeInput, PaymentProvider, PixCharge } from "./types";

type Env = "sandbox" | "production";

// Cache por isolate. No Workers cada isolate mantém o próprio cache; não é
// compartilhado globalmente, mas reduz chamadas OAuth dentro de uma mesma
// instância. Aceitável para o volume esperado.
let cachedToken: { value: string; expiresAt: number; env: Env } | null = null;

function getEnv(): Env {
  const e = (process.env.INTER_ENV ?? "sandbox").toLowerCase();
  return e === "production" ? "production" : "sandbox";
}

function requireProxy(): { url: string; secret: string } {
  const url = process.env.INTER_PROXY_URL;
  const secret = process.env.INTER_PROXY_SECRET;
  if (!url || !secret) {
    throw new Error(
      "Proxy mTLS Inter não configurado (INTER_PROXY_URL / INTER_PROXY_SECRET).",
    );
  }
  return { url: url.replace(/\/$/, ""), secret };
}

async function proxyFetch(path: string, init: RequestInit & { interToken?: string } = {}) {
  const { url, secret } = requireProxy();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${secret}`);
  headers.set("X-Inter-Env", getEnv());
  if (init.interToken) headers.set("X-Inter-Token", init.interToken);
  const { interToken: _omit, ...rest } = init;
  return fetch(url + path, { ...rest, headers });
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  const env = getEnv();
  if (cachedToken && cachedToken.env === env && cachedToken.expiresAt - 30_000 > now) {
    return cachedToken.value;
  }

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

  const res = await proxyFetch("/oauth/v2/token", {
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
    env,
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

    const res = await proxyFetch(`/pix/v2/cob/${encodeURIComponent(input.txid)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      interToken: token,
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
      const qrRes = await proxyFetch(`/pix/v2/loc/${cob.loc.id}/qrcode`, {
        method: "GET",
        interToken: token,
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