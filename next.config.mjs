/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // SDK da Orca (Solana): o núcleo é wasm carregado do disco pelo Node — o
  // bundler do Next não pode empacotá-lo; fica como dependência externa
  serverExternalPackages: ["@orca-so/whirlpools", "@orca-so/whirlpools-client", "@orca-so/whirlpools-core"],
  // O site não usa next/image (os logos são .webp servidos direto de public/).
  // Sem isto, o `next start` deixa aberto o otimizador /_next/image, que roda o
  // sharp no servidor — e o sharp/libheif/librsvg teve falhas de execução
  // remota em 2026 (GHSA-2464-fhr4-w9xw, GHSA-2xp9-vwfh-vxw4). Desligado, o
  // endereço responde 404 e uma falha futura no sharp não alcança a Hostinger.
  images: { unoptimized: true },
  async headers() {
    // Headers de segurança aplicados a todas as rotas. Não usam nonce/CSP de
    // scripts (evita quebrar a hidratação do Next); focam clickjacking,
    // sniffing e vazamento de referrer — relevante num app financeiro.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
