import { llmsTxt } from "../llms";

/** `/llms.txt` — gerado no build a partir de `app/site.ts` (ver `app/llms.ts`). */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
