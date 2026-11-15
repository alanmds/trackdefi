"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseWalletAddress } from "../../core/address";
import { TOOL_GET_POSITIONS, TOOL_OPEN_WALLET, walletPageUrl, type AgentTool } from "../agents";
import { localePath } from "../i18n/config";
import { useI18n } from "../i18n/provider";

/**
 * Ferramentas WebMCP (15/11/2026): um agente de IA que roda DENTRO do
 * navegador do visitante encontra aqui o que o site sabe fazer, sem adivinhar
 * a tela. Duas ferramentas, ambas só de leitura (definições em
 * `app/agents.ts`):
 *  - `get_wallet_positions`: lê as posições pela mesma API da página;
 *  - `open_wallet_page`: abre a página da carteira para a pessoa ver.
 *
 * WebMCP ainda é rascunho (W3C Web Machine Learning CG). O rascunho atual põe
 * a API em `document.modelContext`; as primeiras versões, em
 * `navigator.modelContext` — o componente aceita os dois. Sem a API (quase
 * todo navegador hoje), não faz nada. Não desenha nada na tela.
 */

interface ModelContextLike {
  registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => unknown;
  unregisterTool?: (name: string) => void;
}

function modelContext(): ModelContextLike | null {
  const fromDocument = (document as unknown as { modelContext?: ModelContextLike }).modelContext;
  const fromNavigator = (navigator as unknown as { modelContext?: ModelContextLike }).modelContext;
  const mc = fromDocument ?? fromNavigator;
  return mc && typeof mc.registerTool === "function" ? mc : null;
}

/** resultado no formato de conteúdo do MCP — o que os exemplos do WebMCP usam */
const text = (data: unknown) => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }],
});

const definition = (t: AgentTool) => ({
  name: t.name,
  title: t.title,
  description: t.description,
  inputSchema: t.inputSchema,
  annotations: { readOnlyHint: true },
});

export default function WebMcpTools() {
  const { locale } = useI18n();
  const router = useRouter();

  useEffect(() => {
    const mc = modelContext();
    if (!mc) return;

    const parse = (input: unknown) => {
      const raw = (input as { address?: unknown } | null)?.address;
      return typeof raw === "string" ? parseWalletAddress(raw.trim()) : null;
    };

    const tools = [
      {
        ...definition(TOOL_GET_POSITIONS),
        async execute(input: unknown) {
          const parsed = parse(input);
          if (!parsed) throw new Error("Invalid wallet address.");
          const res = await fetch(`/api/positions?address=${encodeURIComponent(parsed.address)}`);
          const body = (await res.json()) as Record<string, unknown>;
          if (!res.ok) throw new Error(String(body.message ?? "Failed to read the blockchain."));
          delete body.warnings; // log interno, fora da tela e fora do agente
          return text({ page: walletPageUrl(parsed.address), ...body });
        },
      },
      {
        ...definition(TOOL_OPEN_WALLET),
        async execute(input: unknown) {
          const parsed = parse(input);
          if (!parsed) throw new Error("Invalid wallet address.");
          router.push(localePath(locale, `/w/${parsed.address}`));
          return text(`Opened the positions page of ${parsed.address}.`);
        },
      },
    ];

    const controller = new AbortController();
    for (const tool of tools) {
      try {
        const r = mc.registerTool(tool, { signal: controller.signal });
        // o rascunho atual devolve uma Promise; recusa (nome repetido etc.) não pode virar erro solto
        if (r && typeof (r as Promise<unknown>).catch === "function") (r as Promise<unknown>).catch(() => {});
      } catch {
        /* API diferente da esperada — o site segue igual */
      }
    }

    return () => {
      controller.abort(); // rascunho atual: desregistra pelo sinal
      if (mc.unregisterTool) {
        for (const tool of tools) {
          try {
            mc.unregisterTool(tool.name); // versões antigas
          } catch {
            /* já saiu pelo sinal */
          }
        }
      }
    };
  }, [locale, router]);

  return null;
}
