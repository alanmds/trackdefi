/**
 * PoC da Receita A — Velodrome na Optimism (rodar ANTES de mexer no site):
 * 1. verifica on-chain que o endereço candidato do VELO é mesmo o VELO;
 * 2. varre a carteira de teste do repo sugar com o adapter parametrizado;
 * 3. salva fixture cru para os testes.
 *
 *   npx tsx poc/probe-velodrome.ts [0xCARTEIRA]
 */

import { writeFileSync } from "node:fs";
import { erc20Abi, formatUnits, getAddress, isAddress } from "viem";
import { createReader } from "../core/chain";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { VELODROME_OPTIMISM } from "../core/adapters/aerodrome/config";

const reader = createReader(10);

async function main() {
  const arg = process.argv[2];
  const account = arg && isAddress(arg) ? getAddress(arg) : VELODROME_OPTIMISM.testWallet;

  console.log("\n1) Verificando o token de emissões (esperado: VELO)...");
  const [sym, dec] = await Promise.all([
    reader.readContract({ address: VELODROME_OPTIMISM.emissionsToken, abi: erc20Abi, functionName: "symbol" }),
    reader.readContract({ address: VELODROME_OPTIMISM.emissionsToken, abi: erc20Abi, functionName: "decimals" }),
  ]);
  console.log(`   ${VELODROME_OPTIMISM.emissionsToken} → symbol=${sym} decimals=${dec}`);
  if (sym !== "VELO") {
    console.error("   ❌ NÃO é o VELO — corrigir emissionsToken na config antes de seguir!");
    process.exit(1);
  }

  console.log(`\n2) Varrendo ${account} na Velodrome (Optimism)...`);
  const warnings: string[] = [];
  const adapter = new AerodromeAdapter(reader, {
    config: VELODROME_OPTIMISM,
    onWarn: (m) => warnings.push(m),
  });
  const t0 = Date.now();
  const raw = await adapter.fetchRawPositions(account);
  const positions = await adapter.normalize(raw);
  console.log(`   ${positions.length} posição(ões) em ${((Date.now() - t0) / 1000).toFixed(1)} s · avisos: ${warnings.length}`);
  for (const w of warnings) console.log(`   ⚠ ${w}`);

  for (const p of positions.slice(0, 10)) {
    const a0 = Number(formatUnits(p.amount0Raw, p.token0.decimals)).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
    const a1 = Number(formatUnits(p.amount1Raw, p.token1.decimals)).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
    const emissions = p.rewards.filter((r) => r.kind === "emission").map((r) => r.token.symbol).join(",");
    console.log(
      `   • ${p.poolSymbol} [${p.protocol}@${p.chainId}] ${p.kind}${p.staked ? " STAKED" : ""} — ${p.token0.symbol} ${a0} + ${p.token1.symbol} ${a1}${emissions ? ` · emissões: ${emissions}` : ""}${p.range ? (p.range.inRange ? " · NA FAIXA" : " · FORA DA FAIXA") : ""}`,
    );
  }

  if (raw.length > 0) {
    const file = `poc/fixture-velodrome-${account.slice(0, 10)}.json`;
    writeFileSync(
      file,
      JSON.stringify(
        { account, chainId: 10, capturedAt: new Date().toISOString(), positions: raw },
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2,
      ),
    );
    console.log(`\n   Fixture salvo em ${file}`);
  }

  console.log("\n✅ PoC Velodrome OK — decodificação do Sugar na Optimism validada.");
}

main().catch((e) => {
  console.error(`\n❌ PoC falhou: ${(e as Error).message}`);
  process.exit(1);
});
