/**
 * Cloudflare Web Analytics — segunda contagem de visitas, sem cookie, pedida
 * pelo Alan em 15/10/2026 para acompanhar o site pelo painel do Cloudflare.
 *
 * O domínio NÃO passa pelo Cloudflare (DNS na Vercel), então a instalação
 * automática do painel não chega aqui: o script entra pelo código, com o
 * token da variável `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` (Vercel). O token não é
 * segredo — fica visível no HTML —, mas mora na variável para trocar sem
 * commit. Sem a variável, nada é carregado.
 *
 * Decisões do Alan (15/10/2026):
 * - mede TODAS as páginas, inclusive as de carteira, com a navegação interna
 *   (padrão do script, `spa` ligado);
 * - o site NÃO cita o Cloudflare em texto nenhum.
 * A saída do dono (`?notrack=1`, ver `app/analytics-optout.ts`) vale aqui
 * também: aparelho marcado não carrega o script.
 */

export const CF_BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

/** valor do atributo `data-cf-beacon`; null = sem token, não carregar */
export function cfBeaconConfig(token: string | undefined): string | null {
  const t = token?.trim();
  if (!t) return null;
  return JSON.stringify({ token: t });
}
