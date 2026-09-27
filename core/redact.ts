/**
 * Tira segredo de texto que vai para a resposta pública.
 *
 * Os avisos da varredura (`warnings` do DTO) saem na `/api/positions`, que é
 * pública com CORS `*`, e alguns carregam a mensagem de erro do viem — que
 * inclui a URL do RPC. Na Alchemy a chave MORA NA URL
 * (`…alchemy.com/v2/<chave>`). Achado em 27/09/2026: com a Base inteira fora,
 * o aviso "nenhuma factory respondeu" trazia a URL completa.
 *
 * Regra: de qualquer URL, sobra só a origem (`https://host/…`). O host basta
 * para saber qual RPC falhou; caminho e query, onde as chaves ficam, somem.
 */
export function redactUrls(text: string): string {
  return text.replace(/\b(https?|wss?):\/\/([^\s/?#"'<>|]+)[^\s"'<>|]*/gi, (_m, scheme: string, host: string) => {
    const semCredencial = host.includes("@") ? host.slice(host.lastIndexOf("@") + 1) : host;
    return `${scheme}://${semCredencial}/…`;
  });
}
