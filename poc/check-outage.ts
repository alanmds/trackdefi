/**
 * Fase 5 — teste de RPC totalmente fora do ar: aponta a API para uma porta
 * fechada e verifica que a resposta é um 502 limpo (sem stack, sem travar).
 *
 *   npx tsx poc/check-outage.ts
 */

export {}; // módulo (habilita await no topo do arquivo)

// portas fechadas — nada escuta; derruba TODAS as redes do registry
process.env.BASE_RPC_URLS = "http://127.0.0.1:1";
process.env.OPTIMISM_RPC_URLS = "http://127.0.0.1:1";
process.env.ETHEREUM_RPC_URLS = "http://127.0.0.1:1";
process.env.ARBITRUM_RPC_URLS = "http://127.0.0.1:1";
delete process.env.TRACKDEFI_FIXTURE;

const { GET } = await import("../app/api/positions/route");

const t0 = Date.now();
const res = await GET(new Request("http://localhost/api/positions?address=0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC"));
const ms = Date.now() - t0;
const body = (await res.json()) as { error?: string; message?: string };

console.log(`status=${res.status} error=${body.error} em ${ms}ms`);
console.log(`mensagem ao usuário: "${body.message}"`);

const ok = res.status === 502 && body.error === "upstream" && ms < 45_000;
console.log(ok ? "✅ RPC fora do ar → 502 limpo" : "❌ comportamento inesperado");
if (!ok) process.exit(1);
