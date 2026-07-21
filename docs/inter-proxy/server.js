// Minimal mTLS proxy for Banco Inter PJ PIX API.
// Node 18+. Deploy on Fly.io / Render / Railway / VPS.
// See README.md in this folder.

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const PORT = Number(process.env.PORT ?? 8080);
const SECRET = process.env.INTER_PROXY_SECRET;
const CERT = process.env.INTER_CERT_PEM;
const KEY = process.env.INTER_KEY_PEM;

if (!SECRET || !CERT || !KEY) {
  console.error("Missing INTER_PROXY_SECRET / INTER_CERT_PEM / INTER_KEY_PEM");
  process.exit(1);
}

const HOSTS = {
  sandbox: "cdpj-sandbox.partners.uatinter.co",
  production: "cdpj.partners.bancointer.com.br",
};

const agent = new https.Agent({ cert: CERT, key: KEY, keepAlive: true });

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${SECRET}`) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
    const envHeader = String(req.headers["x-inter-env"] ?? "sandbox").toLowerCase();
    const host = envHeader === "production" ? HOSTS.production : HOSTS.sandbox;
    const target = new URL(req.url, `https://${host}`);
    const interToken = req.headers["x-inter-token"];

    const headers = { ...req.headers };
    delete headers["authorization"];
    delete headers["x-inter-token"];
    delete headers["x-inter-env"];
    delete headers["host"];
    delete headers["content-length"];
    if (interToken) headers["authorization"] = `Bearer ${interToken}`;

    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req);

    const upstream = https.request(
      {
        method: req.method,
        host,
        path: target.pathname + target.search,
        headers,
        agent,
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (err) => {
      console.error("upstream error", err);
      if (!res.headersSent) res.writeHead(502);
      res.end(String(err.message ?? err));
    });
    if (body && body.length) upstream.write(body);
    upstream.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end("proxy error");
  }
});

server.listen(PORT, () => console.log(`inter-proxy listening on ${PORT}`));