/**
 * Verificação ao vivo da rota /api/positions chamando o handler GET direto
 * (Next não é necessário — o handler usa Request/Response padrão). Exercita
 * validação, cache, service e a chain real.
 *
 *   npm run check-api
 */

import { GET } from "../app/api/positions/route";

async function hit(query: string) {
  const req = new Request(`http://localhost/api/positions${query}`);
  const t0 = Date.now();
  const res = await GET(req);
  const ms = Date.now() - t0;
  const body = (await res.json()) as any;
  return { status: res.status, ms, cache: res.headers.get("x-cache"), body };
}

async function main() {
  const wallet = "0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC";

  console.log("1) endereço válido (MISS, lê a chain)...");
  const a = await hit(`?address=${wallet}`);
  console.log(
    `   status=${a.status} cache=${a.cache} ${a.ms}ms — ${a.body.positions?.length} posições · ` +
      `total US$ ${a.body.totals?.valueUsd?.toFixed(2)} · a receber US$ ${a.body.totals?.rewardsUsd?.toFixed(2)} · ` +
      `sem preço: ${a.body.totals?.positionsWithoutPrice}`,
  );

  console.log("2) mesma carteira (deve ser HIT, instantâneo)...");
  const b = await hit(`?address=${wallet}`);
  console.log(`   status=${b.status} cache=${b.cache} ${b.ms}ms`);

  console.log("3) endereço inválido (deve ser 400)...");
  const c = await hit(`?address=0xnah`);
  console.log(`   status=${c.status} error=${c.body.error}`);

  console.log("4) sem parâmetro (deve ser 400)...");
  const d = await hit("");
  console.log(`   status=${d.status} error=${d.body.error}`);

  const ok = a.status === 200 && b.status === 200 && b.cache === "HIT" && c.status === 400 && d.status === 400;
  console.log(ok ? "\n✅ API OK" : "\n❌ Algo divergiu");
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
