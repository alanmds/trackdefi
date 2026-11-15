/**
 * O que o site oferece a agentes de IA (15/11/2026): robots.txt com
 * Content-Signal, home em Markdown, servidor MCP, cartão do servidor e dados
 * estruturados com Organization. Ver `app/agents.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  HOME_LINK_HEADER,
  MCP_PATH,
  MCP_PROTOCOL_VERSIONS,
  MCP_TOOLS,
  mcpServerCard,
  prefersMarkdown,
  TOOL_GET_COVERAGE,
  TOOL_GET_POSITIONS,
} from "../app/agents";
import { homeMarkdown } from "../app/home-markdown";
import { llmsTxt } from "../app/llms";
import { handleMcpBody, handleMcpMessage, RPC, type ScanFn } from "../app/mcp-server";
import { CONTENT_SIGNAL, robotsTxt } from "../app/robots-txt";
import { CONTACT_EMAIL, GITHUB_URL, NETWORK_NAMES, SITE_URL, X_URL } from "../app/site";
import { ORG_ID, siteJsonLd } from "../app/structured-data";

const ADDR = "0x1111111111111111111111111111111111111111";

/** varredura falsa: devolve um DTO mínimo, sem rede */
const fakeScan: ScanFn = async (address) => ({
  ok: true,
  address,
  source: "scan",
  body: JSON.stringify({ address, totals: { valueUsd: 12.5 }, positions: [], warnings: ["log interno"] }),
});

const call = (method: string, params?: unknown, id: number | string = 1) => ({ jsonrpc: "2.0", id, method, params });

describe("robots.txt", () => {
  const txt = robotsTxt();
  const linhas = txt.split("\n");

  it("declara a Content-Signal dentro do grupo User-Agent: *", () => {
    const ua = linhas.indexOf("User-Agent: *");
    const cs = linhas.indexOf(`Content-Signal: ${CONTENT_SIGNAL}`);
    const fimDoGrupo = linhas.indexOf("", ua);
    expect(ua).toBeGreaterThanOrEqual(0);
    expect(cs).toBeGreaterThan(ua);
    expect(cs).toBeLessThan(fimDoGrupo);
  });

  it("segue bloqueando carteiras e API, mas libera o servidor MCP", () => {
    expect(linhas).toContain("Disallow: /w/");
    expect(linhas).toContain("Disallow: /pt-br/w/");
    expect(linhas).toContain("Disallow: /api/");
    expect(linhas).toContain(`Allow: ${MCP_PATH}`);
  });

  it("libera as páginas institucionais e aponta o sitemap", () => {
    for (const p of ["/about", "/contact", "/terms", "/pt-br/about"]) expect(linhas).toContain(`Allow: ${p}`);
    expect(linhas).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});

describe("Markdown por Accept", () => {
  it("navegadores recebem HTML", () => {
    expect(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")).toBe(false);
    expect(prefersMarkdown("*/*")).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
  });

  it("agente que pede Markdown recebe Markdown", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
    expect(prefersMarkdown("text/html;q=0.5, text/markdown")).toBe(true);
  });

  it("Markdown com peso menor que HTML, ou zero, não ganha", () => {
    expect(prefersMarkdown("text/html, text/markdown;q=0.5")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
  });

  it("o cabeçalho Link aponta para o Markdown, o llms.txt e o cartão MCP", () => {
    expect(HOME_LINK_HEADER).toContain('</index.md>; rel="alternate"; type="text/markdown"');
    expect(HOME_LINK_HEADER).toContain("</llms.txt>");
    expect(HOME_LINK_HEADER).toContain("</.well-known/mcp/server-card.json>");
  });

  it("a home em Markdown traz a ficha de fatos e o FAQ, sem tags HTML", () => {
    const md = homeMarkdown();
    expect(md.startsWith("# trackdefi")).toBe(true);
    expect(md).toContain("## Frequently asked questions");
    expect(md).not.toMatch(/<\/?(b|em|link)>/);
  });
});

describe("servidor MCP", () => {
  it("initialize ecoa a versão pedida quando a conhece, senão responde a mais nova", async () => {
    const conhecida = await handleMcpMessage(call("initialize", { protocolVersion: "2025-06-18" }), fakeScan);
    expect((conhecida?.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");
    const estranha = await handleMcpMessage(call("initialize", { protocolVersion: "1999-01-01" }), fakeScan);
    const r = estranha?.result as { protocolVersion: string; serverInfo: { name: string }; capabilities: object };
    expect(r.protocolVersion).toBe(MCP_PROTOCOL_VERSIONS[0]);
    expect(r.serverInfo.name).toBe("trackdefi");
    expect(r.capabilities).toHaveProperty("tools");
  });

  it("notificação não tem resposta; ping responde vazio", async () => {
    expect(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, fakeScan)).toBeNull();
    expect((await handleMcpMessage(call("ping"), fakeScan))?.result).toEqual({});
  });

  it("tools/list traz as duas ferramentas, só de leitura", async () => {
    const r = (await handleMcpMessage(call("tools/list"), fakeScan))?.result as { tools: typeof MCP_TOOLS };
    expect(r.tools.map((t) => t.name)).toEqual([TOOL_GET_POSITIONS.name, TOOL_GET_COVERAGE.name]);
    for (const t of r.tools) expect(t.annotations.readOnlyHint).toBe(true);
  });

  it("get_coverage devolve as redes do site", async () => {
    const r = (await handleMcpMessage(call("tools/call", { name: "get_coverage", arguments: {} }), fakeScan))
      ?.result as { content: { text: string }[]; isError: boolean };
    expect(r.isError).toBe(false);
    expect(JSON.parse(r.content[0].text).networks).toEqual([...NETWORK_NAMES]);
  });

  it("get_wallet_positions devolve o DTO com o link da página e sem o log interno", async () => {
    const r = (await handleMcpMessage(
      call("tools/call", { name: "get_wallet_positions", arguments: { address: ADDR } }),
      fakeScan,
    ))?.result as { content: { text: string }[]; isError: boolean };
    const data = JSON.parse(r.content[0].text);
    expect(r.isError).toBe(false);
    expect(data.page).toBe(`${SITE_URL}/w/${ADDR}`);
    expect(data.totals.valueUsd).toBe(12.5);
    expect(data).not.toHaveProperty("warnings");
  });

  it("erro da varredura e endereço ausente viram resultado com isError", async () => {
    const falha: ScanFn = async () => ({ ok: false, code: "invalid_address", message: "Invalid wallet address." });
    const r1 = (await handleMcpMessage(
      call("tools/call", { name: "get_wallet_positions", arguments: { address: "xyz" } }),
      falha,
    ))?.result as { isError: boolean; content: { text: string }[] };
    expect(r1.isError).toBe(true);
    expect(r1.content[0].text).toContain("invalid_address");
    const r2 = (await handleMcpMessage(call("tools/call", { name: "get_wallet_positions", arguments: {} }), fakeScan))
      ?.result as { isError: boolean };
    expect(r2.isError).toBe(true);
  });

  it("ferramenta, método ou mensagem desconhecidos recebem o erro JSON-RPC certo", async () => {
    expect((await handleMcpMessage(call("tools/call", { name: "nope" }), fakeScan))?.error?.code).toBe(RPC.INVALID_PARAMS);
    expect((await handleMcpMessage(call("resources/list"), fakeScan))?.error?.code).toBe(RPC.METHOD_NOT_FOUND);
    expect((await handleMcpMessage({ hello: 1 }, fakeScan))?.error?.code).toBe(RPC.INVALID_REQUEST);
  });

  it("lote: responde só aos pedidos; lote vazio é erro; só notificações = sem corpo", async () => {
    const out = await handleMcpBody([{ jsonrpc: "2.0", method: "notifications/initialized" }, call("ping", undefined, 7)], fakeScan);
    expect(Array.isArray(out) && out.map((r) => r.id)).toEqual([7]);
    expect((await handleMcpBody([], fakeScan)) as { error?: { code: number } }).toHaveProperty("error.code", RPC.INVALID_REQUEST);
    expect(await handleMcpBody([{ jsonrpc: "2.0", method: "notifications/initialized" }], fakeScan)).toBeNull();
  });
});

describe("cartão do servidor MCP", () => {
  const card = mcpServerCard();

  it("tem nome, versão, endpoint absoluto e capacidades", () => {
    expect(card.serverInfo.name).toBe("trackdefi");
    expect(card.serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(card.transport.endpoint).toBe(`${SITE_URL}${MCP_PATH}`);
    expect(card.remotes[0].url).toBe(card.transport.endpoint);
    expect(card.capabilities.tools).toBeDefined();
    expect(card.authentication.required).toBe(false);
  });

  it("lista as mesmas ferramentas que o servidor", () => {
    expect(card.tools.map((t) => t.name)).toEqual(MCP_TOOLS.map((t) => t.name));
  });
});

describe("dados estruturados", () => {
  const graph = siteJsonLd("en")["@graph"] as Array<Record<string, unknown>>;
  const org = graph.find((n) => n["@type"] === "Organization") as Record<string, unknown>;

  it("descreve organização, site e aplicativo, ligados por @id", () => {
    expect(graph.map((n) => n["@type"])).toEqual(["Organization", "WebSite", "WebApplication"]);
    for (const n of graph.slice(1)) expect(n.publisher).toEqual({ "@id": ORG_ID });
  });

  it("a organização tem e-mail de contato e os perfis oficiais", () => {
    expect(org.email).toBe(CONTACT_EMAIL);
    expect((org.contactPoint as Array<{ email: string }>)[0].email).toBe(CONTACT_EMAIL);
    expect(org.sameAs).toEqual([X_URL, GITHUB_URL]);
  });

  it("o e-mail público é do domínio do site, nunca pessoal", () => {
    expect(CONTACT_EMAIL.endsWith(`@${new URL(SITE_URL).hostname}`)).toBe(true);
    expect(CONTACT_EMAIL).not.toMatch(/gmail|hotmail|outlook|yahoo/i);
  });
});

describe("llms.txt para agentes", () => {
  const txt = llmsTxt();
  it("aponta o servidor MCP, o cartão, o Markdown e o contato", () => {
    expect(txt).toContain(`${SITE_URL}${MCP_PATH}`);
    expect(txt).toContain("/.well-known/mcp/server-card.json");
    expect(txt).toContain("Accept: text/markdown");
    expect(txt).toContain(CONTACT_EMAIL);
  });
});
