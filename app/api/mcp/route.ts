/**
 * POST /api/mcp — servidor MCP (Streamable HTTP, sem sessão). Lógica em
 * `app/mcp-server.ts`; ferramentas e textos em `app/agents.ts`.
 *
 * Sem sessão e sem stream: cada POST recebe a resposta em JSON. Por isso o
 * GET (canal de eventos do servidor) responde 405, como a especificação manda
 * para quem não oferece esse canal.
 */

import { RPC, handleMcpBody } from "../../mcp-server";
import { clientIp, scanWallet } from "../wallet-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** nenhum pedido legítimo chega perto disto */
const MAX_BODY_BYTES = 64 * 1024;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET(): Response {
  return new Response("This MCP server answers POST requests only (Streamable HTTP, no SSE stream).", {
    status: 405,
    headers: { allow: "POST, OPTIONS", "content-type": "text/plain; charset=utf-8", ...CORS },
  });
}

export async function POST(request: Request): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return json({ jsonrpc: "2.0", id: null, error: { code: RPC.INVALID_REQUEST, message: "Request too large." } }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: RPC.PARSE_ERROR, message: "Parse error." } }, 400);
  }

  const ip = clientIp(request);
  const out = await handleMcpBody(body, (address) => scanWallet(ip, address));
  if (out === null) return new Response(null, { status: 202, headers: CORS });
  return json(out);
}
