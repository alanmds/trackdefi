/**
 * Mede quanto uma varredura gasta da Alchemy: conta cada pedido HTTP por
 * método e rede e soma uma ESTIMATIVA de CUs (tabela pública da Alchemy,
 * valores aproximados — serve para comparar antes/depois, não para faturar).
 *
 * Uso: npx tsx --env-file=.env.local poc/probe-cu.ts 0xENDERECO [outro...]
 * Roda cada carteira DUAS vezes seguidas (fria, depois com os caches quentes).
 */

const CU: Record<string, number> = {
  eth_call: 26,
  eth_getLogs: 60,
  eth_blockNumber: 10,
  eth_getBlockByNumber: 16,
  eth_chainId: 0,
  eth_getCode: 19,
  eth_getStorageAt: 17,
  eth_getBalance: 19,
  alchemy_getTokenBalances: 26,
  alchemy_getAssetTransfers: 120,
  eth_getTransactionReceipt: 15,
  eth_getTransactionByHash: 17,
  eth_getBlockReceipts: 500,
};

type Row = { n: number; cu: number; status429: number };
let table = new Map<string, Row>();

function note(host: string, method: string, status: number) {
  const key = `${host} ${method}`;
  const r = table.get(key) ?? { n: 0, cu: 0, status429: 0 };
  r.n++;
  r.cu += CU[method] ?? 20;
  if (status === 429) r.status429++;
  table.set(key, r);
}

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const res = await realFetch(input, init);
  if (/\.alchemy\.com\//.test(url)) {
    const host = new URL(url).hostname.replace(".g.alchemy.com", "");
    try {
      const body = JSON.parse(String(init?.body ?? "null"));
      for (const b of Array.isArray(body) ? body : [body]) if (b?.method) note(host, b.method, res.status);
    } catch {
      note(host, "?", res.status);
    }
  }
  return res;
}) as typeof fetch;

function report(label: string, ms: number, positions: number) {
  const rows = [...table.entries()].sort((a, b) => b[1].cu - a[1].cu);
  const total = rows.reduce((s, [, r]) => s + r.cu, 0);
  const calls = rows.reduce((s, [, r]) => s + r.n, 0);
  console.log(`\n=== ${label}: ${(ms / 1000).toFixed(1)} s · ${positions} posições · ${calls} pedidos · ≈ ${total} CU`);
  for (const [k, r] of rows.slice(0, 14)) console.log(`  ${String(r.cu).padStart(7)} CU  ${String(r.n).padStart(5)}×  ${k}${r.status429 ? `  (429: ${r.status429})` : ""}`);
  const byMethod = new Map<string, number>();
  for (const [k, r] of rows) byMethod.set(k.split(" ")[1], (byMethod.get(k.split(" ")[1]) ?? 0) + r.cu);
  console.log("  por método:", [...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([m, c]) => `${m}=${c}`).join("  "));
}

/** gasto por adapter, um de cada vez (mostra quem é o culpado) */
async function perAdapter(wallet: string) {
  const { buildAdapters } = await import("../core/adapters/registry");
  const out: Array<{ name: string; cu: number; n: number; ms: number }> = [];
  for (const a of buildAdapters()) {
    if (a.addressKind === "solana") continue;
    table = new Map();
    const t0 = Date.now();
    try {
      await a.getPositions(wallet);
    } catch {
      /* só queremos o gasto */
    }
    const rows = [...table.values()];
    out.push({ name: `${a.protocol}@${a.chainId}`, cu: rows.reduce((s, r) => s + r.cu, 0), n: rows.reduce((s, r) => s + r.n, 0), ms: Date.now() - t0 });
  }
  out.sort((a, b) => b.cu - a.cu);
  console.log(`
=== por adapter (${wallet.slice(0, 8)}…), total ≈ ${out.reduce((s, r) => s + r.cu, 0)} CU`);
  for (const r of out.slice(0, 25)) console.log(`  ${String(r.cu).padStart(7)} CU  ${String(r.n).padStart(4)}×  ${(r.ms / 1000).toFixed(1).padStart(5)} s  ${r.name}`);
}

async function main() {
  const { getWalletPositions } = await import("../core/service");
  const wallets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (process.argv.includes("--adapters")) {
    await perAdapter(wallets[0] ?? "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac");
    return;
  }
  if (!wallets.length) wallets.push("0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac");
  for (const w of wallets) {
    for (const pass of ["fria", "quente"]) {
      table = new Map();
      const t0 = Date.now();
      const dto = await getWalletPositions(w as `0x${string}`);
      report(`${w.slice(0, 8)}… ${pass}`, Date.now() - t0, dto.totalPositions);
      const slow = dto.warnings.filter((x) => /prazo|429|limit/i.test(x)).length;
      if (slow) console.log(`  avisos de prazo/429: ${slow}`);
    }
  }
}
main();

export {};
