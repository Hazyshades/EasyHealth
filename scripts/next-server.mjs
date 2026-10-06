import { AsyncLocalStorage } from "node:async_hooks";
import { createServer } from "node:http";
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
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((request, response) => {
    const peerAddress = normalizePeerAddress(request.socket.remoteAddress);
    requestPeer.run(peerAddress, () => {
      void handle(request, response, parse(request.url ?? "/", true));
    });
  });

  server.on("error", (error) => {
    console.error("Next server error:", error);
    process.exitCode = 1;
  });

  server.listen(port, hostname, () => {
    console.log(`EasyHealth Next server ready on http://${hostname}:${port}`);
  });
}

void main().catch((error) => {
  console.error("Next server startup failed:", error);
  process.exitCode = 1;
});
