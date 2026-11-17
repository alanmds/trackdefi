/**
 * Quanto custa varrer a Aerodrome (Sugar) da Base com janelas de tamanhos
 * diferentes? Conta pedidos à Alchemy e confere se o RESULTADO é o mesmo.
 * Uso: npx tsx --env-file=.env.local poc/probe-janela-sugar.ts [0xCARTEIRA] [janela...]
 */
let calls = 0;
let tooBig = 0;
let t429 = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const res = await realFetch(input, init);
  if (/\.alchemy\.com\//.test(url)) {
    calls++;
    if (res.status === 429) t429++;
    if (!res.ok) tooBig++;
  }
  return res;
}) as typeof fetch;

async function main() {
  const { createReader } = await import("../core/chain");
  const { AerodromeAdapter } = await import("../core/adapters/aerodrome/index");
  const wallet = (process.argv[2]?.startsWith("0x") ? process.argv[2] : "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac") as `0x${string}`;
  const sizes = process.argv.slice(3).map(Number).filter(Boolean);
  const list = sizes.length ? sizes : [200, 400, 800, 1600, 3200];
  let reference = "";
  for (const w of list) {
    calls = tooBig = t429 = 0;
    const warns: string[] = [];
    const a = new AerodromeAdapter(createReader(8453), { poolWindow: BigInt(w), concurrency: Number(process.env.CONC ?? 4), onWarn: (m) => warns.push(m) });
    const t0 = Date.now();
    const raw = await a.fetchRawPositions(wallet);
    const ms = Date.now() - t0;
    const sig = raw.map((p) => `${p.lp.toLowerCase()}:${p.id}`).sort().join(",");
    if (!reference) reference = sig;
    console.log(
      `janela ${String(w).padStart(5)}: ${String(calls).padStart(4)} pedidos (≈ ${calls * 26} CU) · ${(ms / 1000).toFixed(1)} s · ${raw.length} posições · ` +
        `${sig === reference ? "MESMO resultado" : "RESULTADO DIFERENTE"} · 429=${t429} falhas http=${tooBig} avisos=${warns.length}`,
    );
  }
}
main();

export {};
