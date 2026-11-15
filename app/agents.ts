/**
 * O que o site oferece a AGENTES de IA — fonte única (15/11/2026).
 *
 * Três portas, todas somente leitura, todas descritas a partir daqui:
 *  - servidor MCP em `/api/mcp` (`app/api/mcp/route.ts` + `app/mcp-server.ts`),
 *    para assistentes que falam o Model Context Protocol;
 *  - o cartão do servidor em `/.well-known/mcp/server-card.json`, por onde um
 *    agente descobre o servidor sem ninguém dizer onde ele está;
 *  - ferramentas WebMCP registradas na própria página (`app/ui/WebMcpTools.tsx`),
 *    para agentes que rodam dentro do navegador do visitante.
 * Mais a home em Markdown (`/index.md`, servida no `/` quando o agente pede
 * `Accept: text/markdown` — ver `proxy.ts`).
 *
 * ⚠️ Este arquivo vai para o navegador (WebMCP): nada de servidor aqui.
 * Os textos são para máquinas, em inglês, e não passam pelo i18n de propósito:
 * o agente traduz sozinho, e uma descrição por idioma faria o mesmo
 * servidor anunciar ferramentas diferentes conforme a URL.
 */

import { COVERAGE, NETWORK_NAMES, NO_TOKEN, SITE_NAME, SITE_URL } from "./site";

/** caminho do servidor MCP (Streamable HTTP, sem sessão) */
export const MCP_PATH = "/api/mcp";
/** caminho do cartão do servidor MCP (SEP-1649) */
export const MCP_CARD_PATH = "/.well-known/mcp/server-card.json";
/** representação Markdown da home */
export const HOME_MARKDOWN_PATH = "/index.md";

/** versão do servidor MCP — subir quando uma ferramenta mudar de forma */
export const MCP_SERVER_VERSION = "1.0.0";

/**
 * Versões do protocolo MCP que este servidor fala, da mais nova para a mais
 * velha. O servidor só usa o básico (initialize, ping, tools/list,
 * tools/call), que não mudou entre elas — então ecoa a versão pedida pelo
 * cliente quando ela está aqui, e responde com a mais nova quando não está.
 */
export const MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

/** endereço público da página de uma carteira */
export const walletPageUrl = (address: string) => `${SITE_URL}/w/${address}`;

export interface AgentTool {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: "string"; description: string }>;
    required: string[];
    additionalProperties: false;
  };
  annotations: { readOnlyHint: true; openWorldHint: boolean; idempotentHint: true; destructiveHint: false };
}

const ADDRESS_PARAM = {
  type: "string" as const,
  description:
    "Public wallet address: an EVM address (0x followed by 40 hex characters) or a Solana address (base58, 32 to 44 characters). Never a private key or seed phrase.",
};

/** varre a carteira — a mesma leitura da página `/w/<endereço>` */
export const TOOL_GET_POSITIONS: AgentTool = {
  name: "get_wallet_positions",
  title: "Get liquidity pool positions of a wallet",
  description: `Reads, live from the blockchain, every liquidity pool (LP) position held by a public wallet address on the exchanges and networks ${SITE_NAME} covers — including positions staked in gauges and farms, which leave the wallet. Returns JSON with totals in US dollars and, per position: exchange, network, pool, token amounts, value, pending fees and emissions, price range and whether it is in range, and what the position is earning now. Read-only: it never signs or moves anything. A scan usually takes 5 to 30 seconds.`,
  inputSchema: {
    type: "object",
    properties: { address: ADDRESS_PARAM },
    required: ["address"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true, destructiveHint: false },
};

/** cobertura atual — barata, sem tocar a blockchain */
export const TOOL_GET_COVERAGE: AgentTool = {
  name: "get_coverage",
  title: "List supported exchanges and networks",
  description: `Lists the exchanges (protocols) and networks ${SITE_NAME} can read today. Use it to check whether a wallet's positions can be tracked before scanning.`,
  inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true, destructiveHint: false },
};

/** só no navegador (WebMCP): abre a página da carteira para o visitante ver */
export const TOOL_OPEN_WALLET: AgentTool = {
  name: "open_wallet_page",
  title: "Open a wallet's positions page",
  description: `Opens the ${SITE_NAME} page that shows every liquidity pool position of a public wallet address, so the person in the browser can see it. Read-only.`,
  inputSchema: {
    type: "object",
    properties: { address: ADDRESS_PARAM },
    required: ["address"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true, destructiveHint: false },
};

/** ferramentas do servidor MCP */
export const MCP_TOOLS: readonly AgentTool[] = [TOOL_GET_POSITIONS, TOOL_GET_COVERAGE];

/** o que `get_coverage` devolve */
export function coverageData() {
  return {
    site: SITE_URL,
    networks: [...NETWORK_NAMES],
    protocols: COVERAGE.map((c) => ({ protocol: c.protocol, networks: [...c.networks] })),
  };
}

/** instruções que o servidor manda no `initialize` */
export const MCP_INSTRUCTIONS = `${SITE_NAME} is a free, read-only tracker of liquidity pool positions. Call get_wallet_positions with a public wallet address to get every LP position it holds, staked ones included; call get_coverage to see which exchanges and networks are supported. Numbers are read from the blockchain; prices come from DefiLlama, DexScreener or the pools themselves, and a token nobody can price has a null value instead of a guess. It never needs a private key or seed phrase. ${NO_TOKEN} Each wallet page is public at ${SITE_URL}/w/<address>.`;

/**
 * Cartão do servidor MCP (SEP-1649, "MCP Server Cards").
 *
 * O formato ainda está em discussão (a proposta virou a SEP-2127, baseada no
 * `server.json` do registro oficial). Por isso o cartão traz os campos da
 * SEP-1649 — que é o que os verificadores procuram neste endereço — e também
 * `remotes`/`websiteUrl` no formato do `server.json`, para quem já lê o novo.
 */
export function mcpServerCard() {
  const endpoint = SITE_URL + MCP_PATH;
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
    version: "1.0",
    protocolVersion: MCP_PROTOCOL_VERSIONS[0],
    supportedProtocolVersions: [...MCP_PROTOCOL_VERSIONS],
    serverInfo: {
      name: SITE_NAME,
      title: `${SITE_NAME} — liquidity pool position tracker`,
      version: MCP_SERVER_VERSION,
    },
    description: `Read-only MCP server: every liquidity pool position of a public wallet address, staked ones included, across ${NETWORK_NAMES.length} networks. No authentication, no key.`,
    iconUrl: `${SITE_URL}/icon.svg`,
    documentationUrl: `${SITE_URL}/llms.txt`,
    websiteUrl: SITE_URL,
    transport: { type: "streamable-http", endpoint },
    remotes: [{ type: "streamable-http", url: endpoint }],
    capabilities: { tools: { listChanged: false } },
    authentication: { required: false, schemes: [] as string[] },
    instructions: MCP_INSTRUCTIONS,
    tools: MCP_TOOLS,
  };
}

/**
 * O agente quer Markdown? Sim quando `Accept` lista `text/markdown` com peso
 * maior que zero e pelo menos igual ao de `text/html`. O curinga `*\/*` dos
 * navegadores não conta — navegador nenhum pede Markdown.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  let md = 0;
  let html = 0;
  for (const part of accept.split(",")) {
    const [type, ...params] = part.trim().toLowerCase().split(";");
    let q = 1;
    for (const p of params) {
      const [k, v] = p.trim().split("=");
      if (k === "q") q = Number.isFinite(Number(v)) ? Number(v) : 0;
    }
    const t = type.trim();
    if (t === "text/markdown" || t === "text/x-markdown") md = Math.max(md, q);
    else if (t === "text/html") html = Math.max(html, q);
  }
  return md > 0 && md >= html;
}

/**
 * Cabeçalho `Link` (RFC 8288) da home: aponta para a versão em Markdown, a
 * ficha de fatos (`llms.txt`) e o cartão do servidor MCP.
 */
export const HOME_LINK_HEADER = [
  `<${HOME_MARKDOWN_PATH}>; rel="alternate"; type="text/markdown"`,
  `</llms.txt>; rel="describedby"; type="text/plain"`,
  `<${MCP_CARD_PATH}>; rel="service-desc"; type="application/json"`,
].join(", ");
