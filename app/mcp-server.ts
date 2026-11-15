/**
 * Servidor MCP (Model Context Protocol) do trackdefi — a lógica, sem HTTP.
 *
 * Por que existe (15/11/2026, pedido do Alan): assistentes de IA que falam MCP
 * podem consultar as posições de uma carteira direto, sem raspar a página.
 * É a mesma leitura do site, com as mesmas travas (`app/api/wallet-scan.ts`).
 *
 * Feito à mão, sem o SDK oficial: o servidor só precisa de `initialize`,
 * `ping`, `tools/list` e `tools/call`, sem sessão e sem streaming — cada
 * POST é uma conversa completa. JSON-RPC 2.0, um pedido ou um lote por POST.
 *
 * A varredura entra como parâmetro (`scan`) para os testes rodarem sem rede.
 */

import {
  coverageData,
  MCP_INSTRUCTIONS,
  MCP_PROTOCOL_VERSIONS,
  MCP_SERVER_VERSION,
  MCP_TOOLS,
  TOOL_GET_COVERAGE,
  TOOL_GET_POSITIONS,
  walletPageUrl,
} from "./agents";
import { SITE_NAME } from "./site";
import type { ScanResult } from "./api/wallet-scan";

export type JsonRpcId = string | number | null;

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string };
}

/** códigos de erro do JSON-RPC 2.0 */
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
} as const;

export type ScanFn = (address: string) => Promise<ScanResult>;

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** resultado de ferramenta: JSON em texto (é o que todo cliente MCP lê) */
const toolText = (data: unknown, isError = false) => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }],
  isError,
});

async function callTool(name: string, args: Record<string, unknown>, scan: ScanFn) {
  if (name === TOOL_GET_COVERAGE.name) return toolText(coverageData());

  // get_wallet_positions
  const address = typeof args.address === "string" ? args.address : "";
  if (!address) return toolText("Missing argument: address (a public wallet address).", true);

  const r = await scan(address);
  if (!r.ok) return toolText(`${r.message} (${r.code})`, true);

  /* `warnings` é log interno em português, para depuração — fora da resposta
     ao agente, como fica fora da tela. */
  const dto = JSON.parse(r.body) as Record<string, unknown>;
  delete dto.warnings;
  return toolText({ page: walletPageUrl(r.address), ...dto });
}

/**
 * Responde UMA mensagem JSON-RPC. Notificação (sem `id`) não tem resposta:
 * devolve `null`.
 */
export async function handleMcpMessage(msg: unknown, scan: ScanFn): Promise<JsonRpcResponse | null> {
  if (!isObject(msg) || msg.jsonrpc !== "2.0") {
    return fail(null, RPC.INVALID_REQUEST, "Invalid JSON-RPC 2.0 message.");
  }
  // resposta de cliente (sem `method`) ou notificação: nada a responder
  if (typeof msg.method !== "string") return null;
  if (!("id" in msg) || msg.id === undefined) return null;

  const id = msg.id as JsonRpcId;
  const params = isObject(msg.params) ? msg.params : {};

  switch (msg.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(asked)
        ? asked
        : MCP_PROTOCOL_VERSIONS[0];
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SITE_NAME, title: `${SITE_NAME} — liquidity pool position tracker`, version: MCP_SERVER_VERSION },
        instructions: MCP_INSTRUCTIONS,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: MCP_TOOLS });
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      if (name !== TOOL_GET_POSITIONS.name && name !== TOOL_GET_COVERAGE.name) {
        return fail(id, RPC.INVALID_PARAMS, `Unknown tool: ${name || "(none)"}`);
      }
      const args = isObject(params.arguments) ? params.arguments : {};
      return ok(id, await callTool(name, args, scan));
    }
    default:
      return fail(id, RPC.METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
  }
}

/**
 * Corpo inteiro de um POST: um objeto ou um lote (array). `null` = só havia
 * notificações — o HTTP responde 202 sem corpo.
 */
export async function handleMcpBody(
  body: unknown,
  scan: ScanFn,
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    if (body.length === 0) return fail(null, RPC.INVALID_REQUEST, "Empty batch.");
    const out: JsonRpcResponse[] = [];
    // em sequência: um lote não fura a fila de varreduras
    for (const m of body) {
      const r = await handleMcpMessage(m, scan);
      if (r) out.push(r);
    }
    return out.length ? out : null;
  }
  return handleMcpMessage(body, scan);
}
