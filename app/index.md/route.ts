import { homeMarkdown } from "../home-markdown";

/**
 * `/index.md` — a home em Markdown (ver `app/home-markdown.ts`). O `proxy.ts`
 * também a serve no `/` quando o agente pede `Accept: text/markdown`.
 *
 * `private`: como a mesma resposta pode sair na URL `/`, nenhum cache
 * compartilhado pode guardá-la — senão um navegador receberia Markdown no
 * lugar da página. `Vary: Accept` diz o mesmo a quem respeita o cabeçalho.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(homeMarkdown(), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "private, max-age=3600",
      vary: "Accept",
    },
  });
}
