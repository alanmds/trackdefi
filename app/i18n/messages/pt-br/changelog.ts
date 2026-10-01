/**
 * Log de atualizações em português do Brasil, por `id` (ver `app/changelog.ts`).
 * Mesmas regras do inglês: texto para o USUÁRIO, título até 70 caracteres, e
 * nome de rede ESCRITO À MÃO de propósito (cada entrada é um fato datado).
 */

import type { ChangelogTranslations } from "../../get";

const changelog: ChangelogTranslations = {
  portuguese: {
    title: "O trackdefi agora fala português",
    body: "O site inteiro — páginas de carteira, glossário, roadmap e este log — agora está disponível em português do Brasil, com números e datas no formato brasileiro. Use o seletor de idioma no topo de qualquer página. Mais idiomas virão.",
  },
  "range-distance": {
    title: "Quanto o preço está longe de cada extremo da sua faixa",
    body: "Sob cada ponta da barra da faixa de preço agora aparece quanto o preço precisa se mover, a partir de agora, para chegar até ela — por exemplo −8,03% à esquerda e +32,48% à direita. Quando uma posição está fora da faixa, os mesmos números mostram a distância para o preço voltar a entrar.",
  },
  "no-token": {
    title: "Sem token, sem pré-venda, sem airdrop",
    body: "Alguns projetos cripto com nomes parecidos com o nosso vendem tokens. O trackdefi não tem nenhum, e isso agora está escrito no site: é um rastreador gratuito e somente leitura, sem nada para comprar, resgatar ou conectar. Se alguém lhe oferecer um token ou airdrop do trackdefi, é golpe.",
  },
  "uniswap-v3-newest-nfts": {
    title: "Uniswap v3: carteiras com milhares de NFTs não aparecem mais vazias",
    body: "Bots e traders ativos podem ter milhares de NFTs de posição. Antes líamos só os 1.000 mais antigos, que costumam estar quase todos encerrados, então uma carteira com posições abertas podia aparecer sem nenhuma. Agora lemos primeiro os 1.000 mais recentes.",
  },
  "cost-in-the-open": {
    title: "Quanto custa construir o trackdefi, às claras",
    body: "Uma faixa no topo de todas as páginas agora mostra quantas horas de trabalho e quantos dólares o site consumiu até agora, com o endereço para gorjetas ao lado. As gorjetas são opcionais — o rastreador continua gratuito e somente leitura de qualquer jeito.",
  },
  "superchain-five-more": {
    title: "Mais cinco redes: Lisk, Swell, Metal L2, Superseed e Celo",
    body: "Posições da Velodrome na Lisk, Swell, Metal L2, Superseed e Celo agora também aparecem — as em stake incluídas, com as emissões pendentes de XVELO. Isso completa a implantação da Velodrome na Superchain. Onde dados públicos de preço ainda não chegam (Swell, Metal L2, Superseed), os valores em dólar são lidos dos próprios pools dessas redes.",
  },
  "dexscreener-pool-prices": {
    title: "Ainda menos \"—\": DexScreener e preços de pools em toda a rede",
    body: "Quando a DefiLlama não tem preço para um token, agora consultamos também a DexScreener. Se nenhuma das duas tem, o preço vem de qualquer pool da mesma rede que negocie o token — não só o pool da posição — então recompensas como o XVELO também ganham valor em dólar. O ETH empacotado nas redes da Superchain é precificado como ETH, já que é trocável um por um. Preços lidos de um pool mantêm o sublinhado pontilhado.",
  },
  "prices-from-the-pool": {
    title: "Menos \"—\": preços tirados do próprio pool",
    body: "Quando nossa fonte de preços não cobre um token, mas o outro token do par tem preço, o que falta agora vem do próprio pool da posição — então mais posições mostram um valor em dólar em vez de \"—\". Esses valores têm um sublinhado pontilhado: toque ou passe o mouse para ver de onde veio o preço. É o preço real do pool, mostrado como é, mesmo quando um pool pequeno precifica um token diferente de outros mercados.",
  },
  feedback: {
    title: "Envie seu feedback",
    body: "Achou uma posição que não mostramos, quer uma rede adicionada ou viu um número que parece errado? Agora há um link de Feedback no rodapé de todas as páginas. Toda mensagem é lida por uma pessoa — deixe um e-mail se quiser resposta.",
  },
  "phone-summary": {
    title: "Um resumo da carteira mais compacto no celular",
    body: "No celular, os totais no topo de uma carteira agora ficam dois a dois em vez de empilhados, então sua primeira posição aparece sem precisar rolar. E um link \"O que significam estes números?\" logo abaixo abre o glossário.",
  },
  "demo-wallet": {
    title: "Uma nova carteira de demonstração",
    body: "O link \"Experimente uma carteira de demonstração\" agora abre uma carteira que mostra o que o trackdefi faz de melhor: posições em quatro redes na Uniswap e na Aerodrome, as em stake nos gauges incluídas, com medições de taxas ao vivo e recompensas a resgatar.",
  },
  "tap-tips": {
    title: "As explicações abrem com um toque no celular",
    body: "Os detalhes por trás dos números — o que compõe o Rendendo agora, por que um preço aparece como \"—\", o que significa o status de um lock — só apareciam quando o mouse passava por cima, algo que o celular não faz. Agora um toque os abre no pé da tela. Os cards também cabem em iPhones com zoom de tela maior, e números longos não viram mais links de telefone no Safari.",
  },
  glossary: {
    title: "Um glossário para cada número da página",
    body: "Não sabe o que é \"Rendendo agora\", \"Em stake no gauge\" ou uma faixa de preço como USDC/WETH? O novo glossário explica cada rótulo e valor da página de uma carteira em linguagem simples, na ordem em que aparecem na tela. Ele tem link no rodapé de todas as páginas.",
  },
  "warnings-say-what-happened": {
    title: "Avisos que dizem o que aconteceu",
    body: "O aviso amarelo da varredura dizia só que algo tinha dado errado. Agora cada linha diz o quê: uma rede que não respondeu, ou taxas que foram estimadas porque não puderam ser medidas. Ele só sugere atualizar quando atualizar realmente pode ajudar. Um \"—\" onde deveria haver um preço agora se explica quando você passa o mouse por cima: alguns tokens não têm preço confiável, e isso não é um erro. As recompensas a resgatar também pararam de esconder a parte com preço de uma posição só porque um dos tokens não tem preço.",
  },
  "governance-locks": {
    title: "Locks de governança: veAERO e veVELO",
    body: "AERO e VELO bloqueados agora aparecem ao lado das suas posições de LP: quanto está bloqueado, o poder de voto, a data de desbloqueio e o que está à espera de resgate — o rebase semanal mais as taxas e incentivos dos pools em que o lock votou. Um lock vencido é sinalizado como sacável: os tokens continuam nele, livres para sair, e já não votam.",
  },
  tips: {
    title: "Uma forma opcional de apoiar o site",
    body: "O trackdefi é gratuito e continua gratuito — sem conta, sem assinatura. Se ele poupa seu tempo, agora há um endereço para gorjetas no rodapé de todas as páginas, o mesmo em qualquer rede EVM. As gorjetas ajudam a pagar servidores, nós de blockchain e o trabalho de adicionar redes; nada muda para quem não enviar uma.",
  },
  "two-windows": {
    title: "Duas janelas de medição, lado a lado",
    body: "As taxas de swap agora são medidas em 24 horas e em 15 minutos ao mesmo tempo, cada uma com o valor em dólar ganho dentro da janela. Lê-las juntas diz algo que nenhuma diz sozinha: uma janela curta bem acima da longa significa que o pool está movimentado agora, e bem abaixo significa que o movimento já passou. O limite de plausibilidade também saiu das taxas medidas — um pool que realmente paga 2.000% agora mostra 2.000%, e julgar se isso vale o seu dinheiro é com você, não com a gente.",
  },
  "sharper-apr": {
    title: "APR mais preciso para posições concentradas",
    body: "O APR por posição agora é medido estritamente dentro da sua faixa de preço, então as taxas que o pool ganhou enquanto o preço estava fora da sua faixa não contam mais como suas. Faixas estreitas estavam aparecendo várias vezes acima do real. Uma posição recém-aberta também recebe um número de verdade em minutos, em vez de pegar emprestadas as últimas 24 horas do pool.",
  },
  "security-updates": {
    title: "Atualizações de segurança",
    body: "Dependências do framework e de imagens atualizadas para fechar quatro alertas de alta gravidade. Nada muda na tela — é o trabalho pouco glamoroso que mantém um site seguro de visitar.",
  },
  "uniswap-v4-robinhood": {
    title: "Uniswap v4 na Robinhood Chain",
    body: "A v4 guarda todos os pools dentro de um único contrato e não oferece um jeito barato de perguntar quais posições uma carteira possui, e é por isso que a maioria dos rastreadores a ignora. Nós lemos o histórico: posições, quantidades, faixas de preço e taxas pendentes, conferidas com a interface da própria Uniswap até o centavo.",
  },
  "superchain-five-networks": {
    title: "Cinco redes de uma vez: Unichain, Ink, Mode, Soneium e Fraxtal",
    body: "A implantação da Velodrome na Superchain, adicionada de uma só vez porque essas redes compartilham a arquitetura que já líamos. Posições em stake e emissões pendentes incluídas, como em todo lugar.",
  },
  "apr-from-pool": {
    title: "APR lido do próprio pool",
    body: "O APR de taxas agora vem dos acumuladores on-chain do próprio pool, em vez de um conjunto de dados de terceiros. Ele descreve a sua posição, não a média do pool, e funciona em redes que nenhum provedor de dados cobre ainda.",
  },
  "robinhood-chain": {
    title: "Robinhood Chain, a L2 das ações tokenizadas",
    body: "Uniswap v3 na rede onde ações tokenizadas são negociadas. Posições, quantidades, taxas pendentes e status da faixa funcionam — numa rede lançada semanas antes.",
  },
  "own-domain": {
    title: "Domínio próprio: trackdefi.app",
    body: "O site se mudou para o seu próprio endereço, e os links de carteira agora aparecem com um cartão de pré-visualização decente quando você os compartilha.",
  },
  "earning-now": {
    title: "“Rendendo agora” — o APR da sua posição, não o do pool",
    body: "O APR do pool diz o que o dólar médio de um pool rende. O “Rendendo agora” diz o que a sua posição rende: taxas de swap e emissões contadas separadamente, e um 0% honesto quando uma posição concentrada está fora da faixa e não rende nada.",
  },
  "pool-apr": {
    title: "APR do pool em todas as posições",
    body: "Cada posição passou a mostrar o rendimento do pool por trás dela, com média de 30 dias onde dados públicos cobrem — e “—” onde não cobrem, em vez de um palpite.",
  },
  "uniswap-v3-major-networks": {
    title: "Uniswap v3 na Ethereum, Arbitrum e Optimism",
    body: "A mesma integração que rodava na Base, agora nas principais redes.",
  },
  "velodrome-optimism": {
    title: "Velodrome na Optimism",
    body: "A corretora irmã da Aerodrome, e a primeira rede além da Base. Posições em stake nos gauges e emissões pendentes de VELO incluídas.",
  },
  "uniswap-v3-base": {
    title: "Uniswap v3 na Base",
    body: "A segunda corretora: posições concentradas com as taxas pendentes, lidas direto da blockchain.",
  },
  launch: {
    title: "O trackdefi vai ao ar",
    body: "Cole o endereço de uma carteira e veja as posições dela na Aerodrome, na Base — inclusive as em stake nos gauges, que as carteiras e a maioria dos rastreadores deixam de mostrar assim que você faz stake.",
  },
};

export default changelog;
