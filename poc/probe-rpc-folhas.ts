/**
 * Saúde dos RPCs públicos de cada rede (eth_blockNumber, 3 pedidos seguidos):
 * quem responde, em quanto tempo, e quantas vezes falha. Serve para escolher
 * ordem e reservas das redes-folha, que dependem só de RPC público.
 * Uso: npx tsx poc/probe-rpc-folhas.ts [chainId...]
 */
import { CHAINS } from "../core/chains";

async function ping(url: string): Promise<{ ms: number; ok: boolean; why: string }> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json().catch(() => null)) as { result?: string; error?: { message: string } } | null;
    if (j?.result) return { ms: Date.now() - t0, ok: true, why: "" };
    return { ms: Date.now() - t0, ok: false, why: `HTTP ${r.status} ${j?.error?.message ?? ""}`.trim().slice(0, 50) };
  } catch (e) {
    return { ms: Date.now() - t0, ok: false, why: (e as Error).message.slice(0, 40) };
  }
}

async function main() {
  const only = process.argv.slice(2).map(Number);
  for (const [id, info] of Object.entries(CHAINS)) {
    if (only.length && !only.includes(Number(id))) continue;
    const urls = (info as { defaultRpcs?: string[] }).defaultRpcs ?? [];
    if (!urls.length) continue;
    console.log(`\n${(info as { name?: string }).name ?? id} (${id})`);
    for (const u of urls) {
      const r = [await ping(u), await ping(u), await ping(u)];
      const ok = r.filter((x) => x.ok).length;
      console.log(`  ${ok}/3 ok · ${r.map((x) => x.ms + "ms").join(" ")}  ${u}${ok < 3 ? "  ← " + r.find((x) => !x.ok)?.why : ""}`);
    }
  }
}
main();
export {};
