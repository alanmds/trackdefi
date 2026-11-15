import { mcpServerCard } from "../../../agents";

/**
 * `/.well-known/mcp/server-card.json` — cartão do servidor MCP (SEP-1649):
 * por aqui um agente descobre que existe um servidor em `/api/mcp`, o que ele
 * faz e que não pede autenticação. Gerado no build a partir de `app/agents.ts`.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(mcpServerCard(), null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}
