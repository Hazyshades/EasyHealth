import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { parse } from "node:url";
import next from "next";

const requestPeer = new AsyncLocalStorage();
const runtime = {
  getImmediatePeerAddress: () => requestPeer.getStore() ?? null,
};
const globalScope = globalThis;
globalScope.__easyhealthTrustedIngressRuntime = runtime;

function normalizePeerAddress(value) {
  if (!value) return null;
  return value.startsWith("::ffff:") ? value.slice("::ffff:".length) : value;
}

const dev = process.argv.includes("--dev");
const hostname = process.env.NEXT_HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? "3000");
const tlsEnabled = process.env.NEXT_TLS_ENABLED === "1";
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

function requiredFile(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return readFileSync(value);
}

const tlsOptions = tlsEnabled
  ? {
      key: requiredFile("NEXT_TLS_KEY_FILE"),
      cert: requiredFile("NEXT_TLS_CERT_FILE"),
      ca: requiredFile("NEXT_TLS_CA_FILE"),
      requestCert: true,
      rejectUnauthorized: true,
    }
  : null;

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const handleRequest = (request, response) => {
    const peerAddress = normalizePeerAddress(request.socket.remoteAddress);
    requestPeer.run(peerAddress, () => {
      void handle(request, response, parse(request.url ?? "/", true));
    });
  };
  const server = tlsEnabled
    ? createHttpsServer(tlsOptions, handleRequest)
    : createHttpServer(handleRequest);

  server.on("error", (error) => {
    console.error("EasyHealth Next server error:", error);
    process.exitCode = 1;
  });

  server.listen(port, hostname, () => {
    console.log(
      `EasyHealth Next server ready on ${tlsEnabled ? "https" : "http"}://${hostname}:${port}`,
    );
  });
}

void main().catch((error) => {
  console.error("Next server startup failed:", error);
  process.exitCode = 1;
});
