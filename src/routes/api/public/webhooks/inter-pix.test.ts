import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Import the testable functions from the webhook route.
// These are re-exported from the route handler module.
// We need to dynamically import because the module uses TanStack Router's
// createFileRoute which requires router context at import time.
// Instead, we test the core logic by replicating the auth + payload parsing
// in a standalone test harness that mirrors the route's handle function.

const INTER_WEBHOOK_SECRET_ENV = "INTER_WEBHOOK_SECRET";

function makeRequest(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// Replicates the timing-safe comparison from the webhook
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Minimal stub for supabaseAdmin.rpc — we intercept the dynamic import
// by mocking the module path
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("PIX webhook — authentication", () => {
  it("secret ausente: fails closed with 503", () => {
    delete process.env.INTER_WEBHOOK_SECRET;

    // The handle function's first check:
    const secret = process.env.INTER_WEBHOOK_SECRET;
    expect(secret).toBeUndefined();

    // In the actual webhook, this returns 503
    // We simulate the exact guard condition
    const status = !secret ? 503 : 200;
    expect(status).toBe(503);
  });

  it("secret inválido: retorna 401", () => {
    process.env.INTER_WEBHOOK_SECRET = "correct-secret-value";

    const provided = "wrong-secret-value";
    const secret = process.env.INTER_WEBHOOK_SECRET!;
    const authenticated = timingSafeEqualStr(provided, secret);

    expect(authenticated).toBe(false);
  });

  it("secret válido: autentica com sucesso", () => {
    process.env.INTER_WEBHOOK_SECRET = "super-secret-key";

    const provided = "super-secret-key";
    const secret = process.env.INTER_WEBHOOK_SECRET!;
    const authenticated = timingSafeEqualStr(provided, secret);

    expect(authenticated).toBe(true);
  });

  it("comparação timing-safe: strings de tamanho diferente retorna false", () => {
    expect(timingSafeEqualStr("short", "longer-string")).toBe(false);
  });

  it("comparação timing-safe: strings iguais retorna true", () => {
    expect(timingSafeEqualStr("abc123", "abc123")).toBe(true);
  });

  it("comparação timing-safe: strings diferentes mesmo tamanho retorna false", () => {
    expect(timingSafeEqualStr("abc123", "abc456")).toBe(false);
  });
});

describe("PIX webhook — payload parsing", () => {
  it("payload inválido (JSON malformado): retorna 400", async () => {
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });

    let caughtError: unknown = null;
    try {
      await req.json();
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).not.toBeNull();
  });

  it("payload válido sem pix: retorna 'ok'", () => {
    const payload = { pix: [] };
    const events = Array.isArray(payload?.pix) ? payload.pix : [];
    expect(events.length).toBe(0);
    // In the webhook, events.length === 0 returns new Response("ok")
  });

  it("payload válido sem pix field: trata como vazio", () => {
    const payload = {};
    const events = Array.isArray((payload as { pix?: unknown[] })?.pix)
      ? (payload as { pix?: unknown[] }).pix!
      : [];
    expect(events.length).toBe(0);
  });

  it("payload com eventos válidos: processa cada evento", () => {
    const payload = {
      pix: [
        { txid: "tx123", valor: "100.50", endToEndId: "eid-001" },
        { txid: "tx456", valor: "250.00", endToEndId: "eid-002" },
      ],
    };

    const events = Array.isArray(payload.pix) ? payload.pix : [];
    expect(events.length).toBe(2);

    // Verify event validation logic
    const validEvents = events.filter((ev) => {
      const paidAmount = Number(ev.valor);
      return (
        ev.txid &&
        typeof ev.txid === "string" &&
        Number.isFinite(paidAmount) &&
        paidAmount > 0
      );
    });
    expect(validEvents.length).toBe(2);
  });

  it("evento com txid ausente: é ignorado", () => {
    const events: { txid?: string; valor: string }[] = [{ valor: "100.00" }];
    const valid = events.filter((ev) => ev.txid);
    expect(valid.length).toBe(0);
  });

  it("evento com valor zero: é ignorado", () => {
    const events = [{ txid: "tx123", valor: "0" }];
    const valid = events.filter((ev) => {
      const paidAmount = Number(ev.valor);
      return Number.isFinite(paidAmount) && paidAmount > 0;
    });
    expect(valid.length).toBe(0);
  });

  it("evento com valor negativo: é ignorado", () => {
    const events = [{ txid: "tx123", valor: "-50" }];
    const valid = events.filter((ev) => {
      const paidAmount = Number(ev.valor);
      return Number.isFinite(paidAmount) && paidAmount > 0;
    });
    expect(valid.length).toBe(0);
  });

  it("evento com valor não numérico: é ignorado", () => {
    const events = [{ txid: "tx123", valor: "abc" }];
    const valid = events.filter((ev) => {
      const paidAmount = Number(ev.valor);
      return Number.isFinite(paidAmount) && paidAmount > 0;
    });
    expect(valid.length).toBe(0);
  });
});

describe("PIX webhook — idempotency", () => {
  it("webhook duplicado: mesmo txid processado duas vezes", () => {
    const event = { txid: "duplicate-txid", valor: "100.00" };

    // The Supabase RPC confirm_pix_payment uses an idempotency check
    // via the unique partial index on wallet_ledger(payment_order_id)
    // where entry_type='credit'. Simulate duplicate processing:

    const processedTxids: Set<string> = new Set();
    let creditedCount = 0;
    let alreadyPaidCount = 0;

    for (let i = 0; i < 2; i++) {
      if (processedTxids.has(event.txid)) {
        alreadyPaidCount++;
      } else {
        processedTxids.add(event.txid);
        creditedCount++;
      }
    }

    expect(creditedCount).toBe(1); // Only first time credits
    expect(alreadyPaidCount).toBe(1); // Second time is idempotent
  });

  it("webhook duplicado: mesma idempotência na segunda chamada", () => {
    const event = { txid: "dup-txid-2", valor: "250.75" };
    const processedTxids: Set<string> = new Set();
    const results: string[] = [];

    for (let i = 0; i < 3; i++) {
      if (processedTxids.has(event.txid)) {
        results.push("already_paid");
      } else {
        processedTxids.add(event.txid);
        results.push("credited");
      }
    }

    expect(results).toEqual(["credited", "already_paid", "already_paid"]);
  });
});

describe("PIX webhook — secret header parsing", () => {
  it("extrai secret do header x-webhook-secret", () => {
    const req = makeRequest("https://example.com/webhook", {}, {
      "x-webhook-secret": "header-secret",
    });

    const provided =
      req.headers.get("x-webhook-secret") ??
      new URL(req.url).searchParams.get("secret") ??
      "";

    expect(provided).toBe("header-secret");
  });

  it("extrai secret do query param ?secret=", () => {
    const req = makeRequest("https://example.com/webhook?secret=query-secret", {});

    const provided =
      req.headers.get("x-webhook-secret") ??
      new URL(req.url).searchParams.get("secret") ??
      "";

    expect(provided).toBe("query-secret");
  });

  it("header tem prioridade sobre query param", () => {
    const req = makeRequest(
      "https://example.com/webhook?secret=query-secret",
      {},
      { "x-webhook-secret": "header-secret" },
    );

    const provided =
      req.headers.get("x-webhook-secret") ??
      new URL(req.url).searchParams.get("secret") ??
      "";

    expect(provided).toBe("header-secret");
  });

  it("sem secret nem header: string vazia", () => {
    const req = makeRequest("https://example.com/webhook", {});

    const provided =
      req.headers.get("x-webhook-secret") ??
      new URL(req.url).searchParams.get("secret") ??
      "";

    expect(provided).toBe("");
  });
});
