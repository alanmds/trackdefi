/**
 * Configurações do ecossistema Sugar (Aerodrome/Velodrome e irmãs).
 * O MESMO adapter atende todas as redes do ecossistema — só muda esta
 * config (Receita A do playbook). Fonte: deployments/<chain>.env do repo
 * github.com/velodrome-finance/sugar.
 *
 * Sugar tem VERSÕES por chain — se a varredura quebrar numa rede, conferir
 * primeiro se o endereço mudou no repo.
 */

import type { Address } from "viem";

export interface SugarChainConfig {
  /** id do protocolo no DTO/UI (ex.: "aerodrome") */
  protocol: string;
  chainId: number;
  sugar: Address;
  /** factories (v2 + CL) — usadas só para contar pools e dimensionar a varredura */
  factories: Address[];
  /** token de emissões dos gauges (AERO na Base, VELO na Optimism) */
  emissionsToken: Address;
  /** carteira de teste do próprio repo sugar (PoC/bateria) */
  testWallet: Address;
}

/** Base — conferido em 10/07/2026 (deployments/base.env) */
export const AERODROME_BASE: SugarChainConfig = {
  protocol: "aerodrome",
  chainId: 8453,
  sugar: "0x69dD9db6d8f8E7d83887A704f447b1a584b599A1",
  factories: [
    "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
    "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a",
    "0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef",
  ],
  emissionsToken: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", // AERO
  testWallet: "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac",
};

/** Optimism — conferido em 12/07/2026 (deployments/optimism.env).
 * emissionsToken (VELO) não consta no env: candidato conhecido, VERIFICADO
 * on-chain no PoC da Receita A (symbol() precisa devolver "VELO"). */
export const VELODROME_OPTIMISM: SugarChainConfig = {
  protocol: "velodrome",
  chainId: 10,
  sugar: "0x347512180804A8B40AA7525AE932a31198F074aA",
  factories: [
    "0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a",
    "0xCc0bDDB707055e04e497aB22a59c2aF4391cd12F",
  ],
  emissionsToken: "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db", // VELO
  testWallet: "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac",
};

/**
 * ── Leaf chains da Superchain (Velodrome) ──────────────────────────────────
 * Receita A, 10/08/2026. Levantado dos `deployments/<chain>.env` do repo
 * velodrome-finance/sugar e provado em `poc/probe-superchain.ts` (5/5 verde).
 *
 * Dois fatos que economizam trabalho na próxima leaf chain:
 *
 * 1. **As factories são IDÊNTICAS nas cinco redes.** Não é descuido de
 *    copiar/colar: é o deployment "leaf" da Superchain, que usa endereços
 *    determinísticos. O que muda por rede é só o `LP_SUGAR_ADDRESS`. Por isso
 *    elas moram na constante `LEAF_FACTORIES` — mudou uma, mudou todas.
 * 2. **O token de emissões é o XVELO, e também no mesmo endereço nas cinco.**
 *    Ele NÃO consta no `.env` (a armadilha conhecida da Receita A). Foi
 *    DESCOBERTO on-chain pelo PoC, percorrendo factory → pool → `gauge()` →
 *    `rewardToken()`, e o `symbol()` devolveu "XVELO" nas cinco redes.
 *    ⚠️ A DefiLlama **não tem preço do XVELO** (conferido em 10/08): as
 *    emissões destas redes aparecem em quantidade, com valor "—" honesto.
 */
const LEAF_FACTORIES: Address[] = [
  "0x31832f2a97Fd20664D76Cc421207669b55CE4BC0",
  "0x04625B046C69577EfC40e6c0Bb83CDBAfab5a55F",
  "0x718E46d0962A66942E233760a8bd6038Ce54EdCD",
];

/** XVELO — verificado por `symbol()` no PoC, nas cinco redes */
const XVELO: Address = "0x7f9AdFbd38b669F03d1d11000Bc76b9AaEA28A81";

/** carteira de teste do repo sugar (`TEST_ADDRESS_*`, igual nas cinco) */
const LEAF_TEST_WALLET: Address = "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac";

/** monta a config de uma leaf chain — só o LP_SUGAR difere entre elas */
function leafChain(chainId: number, sugar: Address): SugarChainConfig {
  return { protocol: "velodrome", chainId, sugar, factories: LEAF_FACTORIES, emissionsToken: XVELO, testWallet: LEAF_TEST_WALLET };
}

export const VELODROME_MODE = leafChain(34443, "0x1A3C63c8D442948085E47f88CB377183E23EA01f");
export const VELODROME_INK = leafChain(57073, "0x215cEad02e0b9E0E494DD179585C18a772048a43");
export const VELODROME_UNICHAIN = leafChain(130, "0xE002AF2176f604C250c6C368baB5F27e871559c2");
export const VELODROME_SONEIUM = leafChain(1868, "0x7A0225110765d2A14652323733f616215c5509cf");
export const VELODROME_FRAXTAL = leafChain(252, "0xCAaf4556fF489521d4c722CB275510B602d6276d");

/** as leaf chains, na ordem em que entram no registry */
export const VELODROME_LEAF_CHAINS: SugarChainConfig[] = [
  VELODROME_MODE,
  VELODROME_INK,
  VELODROME_UNICHAIN,
  VELODROME_SONEIUM,
  VELODROME_FRAXTAL,
];

// compatibilidade com código/testes existentes (Base)
export const CHAIN_ID = AERODROME_BASE.chainId;
export const CHAIN_SLUG = "base";
export const LP_SUGAR = AERODROME_BASE.sugar;
export const FACTORIES = AERODROME_BASE.factories;
export const AERO = AERODROME_BASE.emissionsToken;
