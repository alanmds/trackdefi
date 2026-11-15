import { robotsTxt } from "../robots-txt";

/** `/robots.txt` — gerado no build (ver `app/robots-txt.ts`). */
export const dynamic = "force-static";

export function GET() {
  return new Response(robotsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
