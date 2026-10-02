/**
 * Textos das páginas e dos metadados em português do Brasil. O formato é
 * imposto pelo tipo do inglês (`../en/pages.ts`). Glossário de termos fixos
 * em `./ui.ts`.
 */

import type { PagesMessages } from "../en/pages";

const pages: PagesMessages = {
  common: {
    backToSearch: "← Voltar à busca",
  },

  meta: {
    siteTitle: "Rastreador de Pools · {families}",
    siteDescription:
      "Rastreador de LP grátis: cole o endereço de uma carteira e veja cada posição de {families} em {count} redes, inclusive as em stake.",
    ogAlt: "{name} — rastreador de pools de liquidez",
    keywordsBase: [
      "rastreador de pools de liquidez",
      "rastreador de posições LP",
      "Aerodrome",
      "Uniswap v3",
      "Velodrome",
      "PancakeSwap v3",
      "Ramses",
    ],
    keywordNetwork: "rastreador de LP {network}",
    keywordsExtra: ["portfólio DeFi", "liquidez concentrada", "endereço de carteira"],
    walletFallback: "carteira",
    ogCard: {
      title: "Rastreador de Pools de Liquidez",
      subtitle: "Cole o endereço de uma carteira — veja todas as posições de LP, inclusive as em stake.",
      networks: "{count} redes — somente leitura, sem chaves, sem login",
    },
    ogProtocols: "Aerodrome · Velodrome · Uniswap · PancakeSwap · Ramses",
  },

  noToken: "Sem token, sem pré-venda, sem airdrop.",

  home: {
    heading: ["Todas as posições de LP.", "Um só endereço de carteira."],
    lede: "Cole qualquer endereço de carteira e veja todas as posições dela em pools de liquidez em {networks} — valor, taxas pendentes, emissões e faixas de preço. Inclusive as posições em stake nos gauges e nas farms, que a maioria dos rastreadores não mostra.",
    tryDemo: "Sem uma carteira à mão? <link>Experimente uma carteira de demonstração →</link>",
    whatsNew: "<date>Atualizado em {date}</date> — {title}. <link>Novidades →</link>",
    more: "Mais <soon>— veja o roadmap →</soon>",
    featuresAria: "Como funciona",
    features: [
      {
        title: "Somente leitura, por princípio",
        body: "Lemos apenas dados públicos da blockchain. Sem login, sem conectar carteira, sem chaves — o {name} não consegue mexer nos seus fundos.",
      },
      {
        title: "Posições em stake incluídas",
        body: "Posições em stake nos gauges da Aerodrome ou da Velodrome, ou nas farms da PancakeSwap, não aparecem como tokens na carteira. Nós as lemos direto do protocolo, com as emissões pendentes.",
      },
      {
        title: "Números honestos",
        body: "Os valores vêm do estado on-chain e dos preços da DefiLlama. Quando um token não tem preço confiável, mostramos “—” em vez de chutar.",
      },
    ],
    faqAria: "Perguntas frequentes",
    faqTitle: "Perguntas frequentes",
    faq: [
      {
        q: "Como acompanho minhas posições em pools de liquidez em várias redes?",
        a: "Cole o endereço da sua carteira (0x…) na caixa de busca acima. O {name} lê as blockchains e lista todas as posições de LP que esse endereço tem na Aerodrome, Velodrome, Uniswap, PancakeSwap e Ramses em {networks} — valor em dólar, taxas pendentes, emissões e faixas de preço.",
      },
      {
        q: "Por que minhas posições de LP da Aerodrome em stake não aparecem na minha carteira?",
        a: "Quando você coloca uma posição em stake num gauge da Aerodrome para ganhar AERO, o token de LP (ou NFT) vai para o contrato do gauge, e por isso as carteiras e a maioria dos rastreadores de portfólio deixam de mostrá-la. O {name} lê os gauges diretamente, então as posições em stake aparecem com as emissões pendentes. O mesmo vale para os gauges da Velodrome em {velodromeNetworks} e para as posições da PancakeSwap v3 em stake nas farms dela (o MasterChef) na BNB Chain, com o CAKE pendente.",
      },
      {
        q: "Preciso conectar minha carteira ou criar uma conta?",
        a: "Não. Você só cola um endereço público — não há conexão de carteira, login nem chaves privadas. O {name} é somente leitura por construção e não consegue mexer nos fundos.",
      },
      {
        q: "Quais corretoras e redes são suportadas?",
        a: "Hoje: {coverage} — pools clássicos e liquidez concentrada, em stake ou não. Mais redes e corretoras estão no roadmap.",
      },
      {
        q: "O {name} é gratuito?",
        a: "Sim — gratuito, sem conta, sem limites para uso normal. {noToken} Os valores vêm de dados on-chain e de fontes públicas de preço.",
      },
    ],
  },

  howItWorks: {
    title: "Como funciona e por que é seguro",
    description:
      "Como o trackdefi lê suas posições de LP direto da blockchain — sem login, sem conectar carteira, sem chaves — e por que ele nunca consegue mexer nos seus fundos.",
    lede: "O trackdefi mostra as posições em pools de liquidez de qualquer carteira a partir só do endereço público. É uma janela somente leitura para a blockchain — nada além disso.",
    safeTitle: "Por que é seguro",
    safe: [
      "<b>Nunca pedimos chave privada nem frase de recuperação.</b> Se algum site pedir isso para “ver suas posições”, saia. Isso nunca é necessário para ler dados públicos.",
      "<b>Sem conexão de carteira.</b> Você cola um endereço; não conecta uma carteira. O trackdefi não tem permissão para mover, aprovar nem assinar nada.",
      "<b>Somente leitura por construção.</b> O app só faz chamadas de <em>leitura</em> à blockchain. Não existe caminho no código capaz de enviar uma transação, porque ele nunca tem uma chave.",
      "<b>Só dados públicos.</b> O endereço de uma carteira é público. Qualquer pessoa já pode consultá-lo num explorador de blocos — o trackdefi apenas o torna legível.",
    ],
    howTitle: "Como funciona",
    how: [
      "Você cola o endereço de uma carteira. Lemos os dados on-chain das corretoras suportadas, em todas as nossas redes, para achar cada posição dessa carteira — pools clássicos, posições concentradas e posições em stake nos gauges ou nas farms, que não aparecem como tokens na carteira.",
      "Para cada posição calculamos quanto ela tem de cada token, as taxas pendentes e as emissões pendentes, quando a corretora as paga — e, nas posições concentradas, se o preço está dentro da faixa que você escolheu.",
      "Os valores em dólar vêm de dados públicos de preço (DefiLlama, depois DexScreener). Quando nenhum dos dois cobre um token, lemos o preço dele num pool da mesma rede e o marcamos com um sublinhado pontilhado. Quando nada consegue precificar um token, mostramos “—” em vez de chutar.",
    ],
    notTitle: "O que não fazemos",
    not: [
      "Não damos recomendação financeira. Os números são informativos; confira na blockchain antes de agir.",
      "Não garantimos preços nem que a lista esteja completa — os dados podem atrasar até um minuto em relação à blockchain.",
    ],
    coverageTitle: "Cobertura",
    coverage:
      "Hoje: {coverage}. O app foi construído para que mais redes e corretoras possam ser adicionadas sem mudar o jeito como ele funciona para você — veja <roadmap>o roadmap</roadmap>.",
  },

  roadmap: {
    title: "Roadmap — redes e corretoras",
    heading: "Roadmap",
    description:
      "Onde o trackdefi está hoje e para onde vai: APR por posição, Aerodrome, Velodrome, Uniswap, PancakeSwap e Ramses em {count} redes; em seguida, SushiSwap, Polygon, Avalanche e mais.",
    lede: "Onde o trackdefi está hoje e para onde vai. Sem prazos e sem promessas — as prioridades seguem o que os usuários realmente pedem. Uma coisa nunca muda: <b>somente leitura, para sempre</b>.",
    status: { live: "✓ No ar", next: "→ Próximo", planned: "Planejado", exploring: "Explorando" },
    liveTitle: "No ar hoje",
    live: [
      {
        title: "APR por posição — “Rendendo agora”",
        body: "o que <em>a sua</em> posição rende agora, não a média do pool: taxas de swap e emissões contadas separadamente, e um 0% honesto quando uma posição concentrada está fora da faixa e não rende nada.",
      },
      {
        title: "Locks de governança · veAERO e veVELO",
        body: "AERO e VELO bloqueados ao lado das suas posições: quantidade, poder de voto, data de desbloqueio e as recompensas de rebase e de voto à espera de resgate. Locks vencidos aparecem sinalizados como sacáveis.",
      },
      {
        title: "Base · Aerodrome",
        body: "posições clássicas e concentradas (Slipstream), inclusive as em stake nos gauges, com taxas pendentes e emissões de AERO.",
      },
      {
        title: "Base · Uniswap v3",
        body: "posições concentradas com taxas pendentes, lidas direto da blockchain.",
      },
      {
        title: "Optimism · Velodrome",
        body: "a corretora irmã da Aerodrome: posições em stake e emissões de VELO incluídas. Nossa primeira rede extra.",
      },
      {
        title: "Ethereum, Arbitrum e Optimism · Uniswap v3",
        body: "a integração da Base, agora nas principais redes.",
      },
      {
        title: "Robinhood Chain · Uniswap v3",
        body: "a L2 das ações tokenizadas, lançada em julho de 2026 e já uma das maiores implantações da Uniswap v3 em liquidez. Posições, quantidades, taxas pendentes e status da faixa funcionam; o APR do pool aparece como “—” até que dados públicos de rendimento cubram esta rede.",
      },
      {
        title: "Unichain, Ink, Mode, Soneium e Fraxtal · Velodrome",
        body: "a implantação da Velodrome na Superchain. Cinco redes de uma vez, porque compartilham a mesma arquitetura que já líamos: posições em stake e emissões pendentes de XVELO incluídas. Os <em>valores</em> das emissões aparecem como “—” enquanto dados públicos de preço não cobrirem o XVELO — as quantidades são exatas de qualquer forma.",
      },
      {
        title: "Robinhood Chain · Uniswap v4",
        body: "a arquitetura de contrato único com hooks. Posições, quantidades, faixas de preço e taxas de swap pendentes, conferidas com a interface da própria Uniswap até o centavo. Posições encerradas ficam ocultas, como na Uniswap.",
      },
      {
        title: "Lisk, Swell, Metal L2, Superseed e Celo · Velodrome",
        body: "o restante da implantação da Velodrome na Superchain, lido do mesmo jeito que as cinco primeiras. Posições, quantidades, posições em stake e emissões pendentes de XVELO são todas exatas. Onde dados públicos de preço ainda não chegam (Swell, Metal L2, Superseed), os valores em dólar são lidos dos próprios pools dessas redes.",
      },
      {
        title: "BNB Chain · PancakeSwap v3",
        body: "a maior corretora da BNB Chain. Posições concentradas, quantidades, faixas de preço e taxas pendentes — e as posições em stake nas farms da PancakeSwap, com o CAKE pendente e o que rendem em CAKE agora. Nossa primeira rede fora das L2 do Ethereum.",
      },
      {
        title: "Robinhood Chain · Ramses",
        body: "a corretora ve(3,3) de taxas dinâmicas, lida na rede onde está a maior parte da liquidez dela: posições concentradas, quantidades, faixas de preço e taxas pendentes.",
      },
      {
        title: "HyperEVM · Ramses",
        body: "a outra grande casa da Ramses, e a que tem gauges: ela paga RAM a toda posição dentro da faixa num pool com gauge, sem precisar de stake. O trackdefi mostra o RAM a resgatar e o que cada posição está rendendo em RAM agora. Na maioria desses pools as taxas de swap vão para quem vota com RAM, então as taxas aparecem como 0% ali: é o número real, não uma falha.",
      },
    ],
    nextTitle: "Próximo",
    next: [
      {
        title: "Unichain e BNB Chain · Uniswap v3",
        body: "a Uniswap v3 em duas redes que o trackdefi já lê: posições, quantidades, faixas de preço e taxas pendentes.",
      },
      {
        title: "Ethereum, Base e Arbitrum · PancakeSwap v3",
        body: "a mesma leitura da BNB Chain, inclusive as posições em stake nas farms da PancakeSwap com o CAKE pendente.",
      },
      {
        title: "SushiSwap v3",
        body: "na Ethereum, Optimism, BNB Chain, Base e Arbitrum: posições concentradas, quantidades, faixas de preço e taxas pendentes. Ela é construída como a Uniswap v3, então o trackdefi já sabe lê-la.",
      },
      {
        title: "HyperEVM · Hyperswap e Project X",
        body: "as duas maiores corretoras nativas da HyperEVM, ao lado da Ramses.",
      },
    ],
    plannedTitle: "Planejado",
    planned: [
      {
        title: "Polygon · Uniswap v3 e SushiSwap v3",
        body: "uma rede nova, começando pelas corretoras que o trackdefi já lê em outras redes.",
      },
      {
        title: "Avalanche · Uniswap v3 e SushiSwap v3",
        body: "o mesmo passo na Avalanche C-Chain.",
      },
      {
        title: "Uniswap v4 em mais redes",
        body: "Ethereum, Optimism, BNB Chain, Polygon, Base, Arbitrum, Avalanche e Unichain. As posições da v4 não podem ser listadas por carteira na própria rede; um caminho alternativo já foi testado e funciona, e ele também cobre as carteiras maiores na Robinhood Chain.",
      },
      {
        title: "QuickSwap v3, Camelot v3 e THENA",
        body: "na Polygon, Arbitrum e BNB Chain. Essas corretoras rodam no Algebra, um motor de liquidez concentrada diferente, então precisam de um leitor próprio.",
      },
      {
        title: "Pools clássicos (v2)",
        body: "os pools 50/50 mais antigos da Uniswap, PancakeSwap, SushiSwap, QuickSwap e Camelot, em todas as redes onde existem. Uma posição clássica é um token, não um NFT, então precisa de outro jeito de ser encontrada.",
      },
      {
        title: "Arc · Aerodrome e Uniswap",
        body: "a rede da Circle, onde o novo Aero é lançado. A parte da Aerodrome espera a documentação do Aero para integradores.",
      },
      {
        title: "BNB Chain e Base · PancakeSwap Infinity",
        body: "a versão mais nova da PancakeSwap, com pools concentrados e faixas de liquidez em blocos (bins): dois tipos diferentes de posição, cada um com sua matemática.",
      },
      {
        title: "Ethereum · Ekubo",
        body: "uma corretora desenhada do zero, com arquitetura e matemática de preço próprias, e não uma cópia de alguma que o trackdefi já lê.",
      },
      {
        title: "Solana · Orca",
        body: "nossa primeira rede fora da família Ethereum. Uma prova de conceito já lê posições da Orca a partir de dados públicos — quantidades, faixa de preço, status dentro da faixa, taxas e recompensas pendentes — então o que resta é encanamento, não pesquisa. Raydium e Meteora viriam depois.",
      },
      {
        title: "Todas as principais redes DeFi",
        body: "a meta de longo prazo: um endereço, todas as redes, todas as posições.",
      },
    ],
    exploringTitle: "Explorando",
    exploring: [
      {
        title: "Desempenho histórico",
        body: "lucro e prejuízo e perda impermanente desde a abertura de cada posição.",
      },
      {
        title: "Alertas de fora da faixa",
        body: "receber um aviso quando uma posição concentrada parar de render taxas.",
      },
      {
        title: "Idade do pool",
        body: "há quanto tempo o pool existe, mostrado ao lado do APR. Um pool novinho com APR alto é um sinal diferente de um pool antigo com o mesmo número.",
      },
    ],
    neverTitle: "O que nunca vai mudar",
    never: [
      "Sem login, sem conectar carteira, sem chaves privadas — o trackdefi não consegue mexer nos fundos.",
      "{noToken} O trackdefi é uma ferramenta gratuita, não um investimento — quem lhe oferecer um token do trackdefi está aplicando um golpe.",
      "Números honestos: quando um token não tem preço confiável, mostramos “—”, nunca um palpite.",
      "Lido direto da blockchain, para que o que você vê seja a verdade on-chain.",
    ],
    updated: "Última atualização: {date} — veja <link>o que foi ao ar e quando</link>.",
  },

  changelog: {
    title: "Novidades — cada atualização, com data",
    description:
      "Cada mudança que chegou ao {name}, da mais recente para a mais antiga: corretoras e redes adicionadas, melhorias de APR e manutenção, em {count} redes. Com data e em linguagem simples.",
    heading: "Novidades",
    lede: "Cada mudança que chegou ao site, da mais recente para a mais antiga — recursos, redes, corretoras e a manutenção entre elas. As datas são o dia em que cada uma foi ao ar, não o dia em que foi escrita.",
    note: "Para onde vamos a seguir — e o que nunca vai mudar — está no <roadmap>roadmap</roadmap>.",
    kinds: {
      network: "Nova rede",
      exchange: "Nova corretora",
      feature: "Novo recurso",
      improvement: "Melhoria",
      maintenance: "Manutenção",
      project: "Novidade do projeto",
    },
  },

  feedback: {
    title: "Feedback",
    description:
      "Sugira um recurso, peça uma rede ou conte sobre uma posição que o trackdefi não mostrou. Toda mensagem é lida por uma pessoa.",
    lede: "Uma ideia, uma rede ou corretora que você gostaria de ver, uma posição que não mostramos, um número que parece errado — toda mensagem é lida por uma pessoa.",
  },

  glossary: {
    title: "Glossário — o que significa cada número",
    description:
      "Guia em linguagem simples de tudo que o trackdefi mostra para uma carteira: valor da posição, recompensas a resgatar, Rendendo agora, faixas de preço, gauges, locks de governança e mais.",
    heading: "Glossário",
    lede: "O que significa cada número e rótulo da página de uma carteira, na ordem em que aparecem na tela.",
    tocAria: "Seções",
    note: "Os valores em dólar usam dados públicos de preço da DefiLlama e podem atrasar até um minuto em relação à blockchain. Nada aqui é recomendação financeira — confira na blockchain antes de agir. Veja também <how>como funciona e por que é seguro</how>.",
    sections: [
      {
        id: "summary",
        title: "O resumo no topo",
        intro: "As caixas acima dos cards somam a carteira inteira.",
        terms: [
          {
            id: "total-in-pools",
            term: "Total em pools",
            def: "O valor em dólar de todas as posições de liquidez da carteira, a preços atuais. Conta os tokens que estão em cada posição — não as recompensas à espera de resgate, nem os locks de governança, que têm caixa própria.",
          },
          {
            id: "without-reliable-price",
            term: "+ N posições sem preço confiável",
            def: "Posições que têm pelo menos um token que nossa fonte de preços não cobre. Ficam fora do total em vez de serem chutadas. Isto não é um erro, e atualizar não muda isso. Veja <dash>“—”</dash>.",
          },
          {
            id: "locked",
            term: "Bloqueado",
            def: "O valor em dólar dos <lock>locks de governança</lock> da carteira (veAERO, veVELO). Aparece só quando a carteira tem algum.",
          },
          {
            id: "claimable-rewards",
            term: "Recompensas a resgatar",
            def: "Tudo que a carteira pode coletar agora, em dólares: taxas de swap e emissões das posições, mais as recompensas dos locks. Nada disso foi coletado ainda — é o que está à espera.",
          },
          {
            id: "rewards-without-price",
            term: "+ N recompensas sem preço confiável",
            def: "Tokens a resgatar sem preço na nossa fonte de preços. As quantidades estão listadas em cada card, mas não podem entrar numa soma em dólar.",
          },
          {
            id: "positions",
            term: "Posições · varridas em N s",
            def: "Quantas posições de liquidez foram encontradas e quanto tempo levou para ler {networks} e achá-las.",
          },
          {
            id: "showing-top",
            term: "Mostrando as N maiores posições",
            def: "Algumas carteiras têm milhares de posições minúsculas. Passado um limite, só as maiores aparecem como cards — mas os totais acima continuam incluindo todas.",
          },
          {
            id: "scan-warnings",
            term: "⚠ Avisos amarelos",
            def: "Algo que não saiu como planejado nesta varredura, uma linha para cada: uma rede que não respondeu, um serviço de preços que falhou, taxas que tiveram de ser estimadas. Uma linha só termina em “Atualize para tentar de novo” quando atualizar de fato pode ajudar — as outras descrevem um limite conhecido que recarregar não muda.",
          },
        ],
      },
      {
        id: "position-card",
        title: "Um card de posição",
        intro: "Cada card é uma posição: liquidez que você depositou em um pool.",
        terms: [
          {
            id: "pool-name",
            term: "Nome do pool (ex.: CL100-WETH/USDC)",
            def: "Os dois tokens do pool, mais um prefixo ou sufixo que diz de que tipo de pool se trata:",
            list: [
              "<b>CL + número</b> — um pool concentrado. O número é o tick spacing: com que finura a faixa de preço pode ser definida. Números pequenos são usados em pares que se movem pouco um em relação ao outro.",
              "<b>vAMM</b> — um pool clássico volátil; <b>sAMM</b> — um pool clássico estável, feito para tokens que devem negociar perto de 1:1.",
              "<b>Uma porcentagem (ex.: WETH/USDC 0,05%)</b> — um pool da Uniswap e sua faixa de taxa: a parte de cada swap paga à liquidez do pool.",
            ],
            after: "Clicar no nome abre o pool no explorador de blocos da rede.",
          },
          {
            id: "position-value",
            term: "Valor (canto superior direito)",
            def: "Quanto valem agora, em dólares, os tokens desta posição. As recompensas a resgatar não estão incluídas. Um “—” significa que um dos tokens não tem preço confiável.",
          },
          {
            id: "network",
            term: "Selo da rede",
            def: "A blockchain onde a posição está — uma entre {networks}.",
          },
          {
            id: "exchange",
            term: "Selo da corretora",
            def: "A corretora que mantém o pool: {exchanges}.",
          },
          {
            id: "concentrated",
            term: "Concentrada",
            def: "Uma posição que fornece liquidez apenas dentro de uma <range>faixa de preço</range> que você escolheu. Dentro da faixa, rende mais taxas por dólar do que uma posição clássica; fora dela, não rende nada. Cada uma é um NFT.",
          },
          {
            id: "classic",
            term: "Clássica · volátil / Clássica · estável",
            def: "Uma posição espalhada por todos os preços possíveis, então nunca fica fora da faixa — rende menos por dólar, mas sempre rende. Pools estáveis usam uma curva pensada para tokens que negociam perto do mesmo preço; os voláteis, para todo o resto.",
          },
          {
            id: "in-range",
            term: "✓ Dentro da faixa / ⚠ Fora da faixa",
            def: "Se o preço atual está dentro da faixa da posição. Dentro da faixa, ela rende. Fora, não ganha taxas de swap, e se estiver em stake, as emissões do gauge também param. As taxas ganhas antes de sair da faixa continuam disponíveis para resgate.",
          },
          {
            id: "staked",
            term: "Em stake no gauge",
            def: "A posição foi depositada no gauge da corretora — um contrato que paga emissões (o token da própria corretora) a quem fornece liquidez. O stake tira a posição da carteira, e é por isso que a maioria das carteiras e muitos rastreadores deixam de mostrá-la. O trackdefi lê os gauges diretamente.",
          },
          {
            id: "staked-farm",
            term: "Em stake na farm",
            def: "A versão do gauge na PancakeSwap: a posição foi depositada numa farm da PancakeSwap (o contrato MasterChef), que paga CAKE. O efeito é o mesmo — a posição sai da carteira, e o trackdefi lê a farm diretamente.",
          },
          {
            id: "alm",
            term: "Gerida por ALM",
            def: "A posição é operada por um gestor automático de liquidez, que move a faixa de preço por você conforme o mercado se move.",
          },
          {
            id: "nft",
            term: "NFT #",
            def: "O ID do NFT que representa uma posição concentrada. É assim que você encontra a posição exata na corretora ou num explorador de blocos.",
          },
        ],
      },
      {
        id: "earning",
        title: "O que a posição está rendendo",
        intro:
          "As taxas aqui são <b>anualizadas</b>: o que a posição renderia em um ano se o ritmo atual se mantivesse. São estimativas a partir de dados ao vivo, não um retorno que você já obteve — e o ritmo pode mudar rápido.",
        terms: [
          {
            id: "earning-now",
            term: "Rendendo agora",
            def: "O que ESTA posição está rendendo agora — a sua posição, não a média do pool. Uma faixa mais estreita costuma render mais por dólar do que a média do pool enquanto permanece dentro da faixa.",
          },
          {
            id: "last-24h",
            term: "Últimas 24 h / Últimas 15 min",
            def: "Taxas de swap que esta posição realmente ganhou, medidas no contrato do pool em duas janelas. Cada linha mostra a taxa anualizada e os dólares ganhos dentro daquela janela. Leia as duas juntas: uma taxa de 15 minutos bem acima da de 24 horas significa que o pool está movimentado agora; bem abaixo, que a correria já passou. Anualizar 15 minutos multiplica o valor por 35.040, então fique de olho no valor em dólar ao lado. Nos pools da Ramses com gauge, as taxas de swap vão para quem vota com RAM, então estas linhas mostram 0% — a posição ganha RAM no lugar, na linha de Emissões.",
          },
          {
            id: "emissions-rate",
            term: "Emissões · US$/dia neste ritmo",
            def: "O token de recompensa que o gauge está pagando a esta posição, na taxa atual do gauge e ao preço atual do token. Só para posições dentro da faixa e em stake — ou, na Ramses, qualquer posição dentro da faixa num pool com gauge, porque a Ramses paga sem stake. O percentual não tem teto: quando um gauge paga muito a uma posição pequena, o número fica alto — e é real. Os dólares por dia ao lado dizem o que isso significa em dinheiro.",
          },
          {
            id: "fees-plus-emissions",
            term: "taxas X% + emissões Y%",
            def: "As duas partes que somam o Rendendo agora. Quando a linha mostra isto em vez das linhas de 24 h / 15 min, as taxas não puderam ser medidas no contrato nesta varredura, então a taxa delas é estimada a partir de dados gerais do pool e da sua fatia da liquidez ativa do pool.",
          },
          {
            id: "pool-apr-ref",
            term: "pool X%",
            def: "A taxa média de toda a liquidez dentro da faixa no pool, segundo a DefiLlama — uma referência para comparar com a sua posição.",
          },
          {
            id: "out-of-range-zero",
            term: "Rendendo agora 0% · fora da faixa",
            def: "O preço saiu da sua faixa, então a posição não rende nada até voltar — ou até você mover a faixa.",
          },
          {
            id: "just-opened",
            term: "Rendendo agora — · recém-aberta",
            def: "A posição é nova demais para medir. A menor janela é de 15 minutos, então a primeira leitura aparece quando a posição tiver essa idade.",
          },
          {
            id: "pool-apr",
            term: "APR do pool · média 30d",
            def: "Aparece quando não conseguimos calcular um número para a sua própria posição: a taxa atual do pool e a média de 30 dias, segundo a DefiLlama. Descreve o pool, não o seu retorno pessoal.",
          },
        ],
      },
      {
        id: "tokens-range",
        title: "Tokens e faixa de preço",
        terms: [
          {
            id: "token-rows",
            term: "Linhas de token (ex.: WETH 1,5 US$ 4.500,00)",
            def: "Quanto de cada token a posição tem agora e quanto isso vale. A composição muda com o preço: quando um token fica mais caro, o pool o vende da sua posição em troca do outro.",
          },
          {
            id: "price-range",
            term: "Barra da faixa de preço",
            def: "Os números da esquerda e da direita são os extremos da faixa; <b>agora</b> é o preço atual, e o marcador mostra onde ele está. Verde significa dentro da faixa. Quando o preço passa de um extremo, a barra fica laranja e o marcador é fixado naquele lado — a posição fica então 100% em um dos dois tokens. As porcentagens sob cada extremo mostram quanto o preço precisa se mover, a partir de agora, para chegar até ele: −8,00% sob o extremo esquerdo significa que uma queda de 8% tira a posição da faixa daquele lado. Fora da faixa, os dois têm o mesmo sinal — a distância de volta a cada extremo.",
          },
          {
            id: "price-unit",
            term: "Unidade de preço (ex.: USDC/WETH)",
            def: "A unidade dos números da faixa: quantos do primeiro token vale um do segundo. USDC/WETH a 3.000 significa 1 WETH = 3.000 USDC.",
          },
          {
            id: "pool-price",
            term: "Valor em dólar com sublinhado pontilhado",
            def: "Nossas fontes de preço não cobrem aquele token, então o preço dele vem de um pool da mesma rede — o pool da própria posição, sempre que possível: o preço de mercado do outro token vezes a taxa de câmbio dentro do pool. É o preço real do pool — mostrado como é, mesmo quando um pool pequeno ou raso precifica o token diferente de outros mercados.",
          },
        ],
      },
      {
        id: "claimable",
        title: "A resgatar",
        terms: [
          {
            id: "claimable-fees",
            term: "taxas",
            def: "Taxas de swap que a posição ganhou e ainda não coletou, token por token.",
          },
          {
            id: "claimable-emissions",
            term: "emissões",
            def: "Recompensas de gauge ganhas por uma posição e ainda não resgatadas — uma em stake ou, na Ramses, qualquer posição num pool com gauge.",
          },
          {
            id: "total-claimable",
            term: "Total a resgatar",
            def: "A soma em dólar das linhas acima. Quando algumas não têm preço, mostra a parte com preço seguida dos nomes das outras (ex.: “US$ 12,40 + XYZ”).",
          },
        ],
      },
      {
        id: "locks",
        title: "Locks de governança",
        intro: "Aparecem acima das posições quando a carteira bloqueou AERO ou VELO para votar.",
        terms: [
          {
            id: "governance-lock",
            term: "veAERO #id / veVELO #id · Lock de governança",
            def: "Tokens bloqueados em troca de poder de voto. Toda semana, quem tem lock vota em quais pools recebem emissões, e é pago por isso. O lock é um NFT; o número é o ID dele.",
          },
          {
            id: "locked-amount",
            term: "AERO bloqueado / VELO bloqueado",
            def: "Quantos tokens estão dentro do lock e quanto valem agora.",
          },
          {
            id: "voting-power",
            term: "Poder de voto",
            def: "O peso atual do lock em votos. Ele diminui de forma constante até zero conforme a data de desbloqueio se aproxima — a não ser que o lock seja permanente.",
          },
          {
            id: "unlocks",
            term: "Desbloqueia em [data]",
            def: "A data em que os tokens podem ser sacados.",
          },
          {
            id: "permanent",
            term: "Lock permanente",
            def: "Bloqueado sem data de desbloqueio; o poder de voto não decai.",
          },
          {
            id: "expired",
            term: "⚠ Vencido — pode sacar",
            def: "A data de desbloqueio passou. Os tokens continuam no lock, livres para sair — e o lock não tem mais poder de voto.",
          },
          {
            id: "managed",
            term: "Em lock gerenciado #",
            def: "Este lock foi depositado num lock gerenciado (um relay) que vota em nome dele. Os tokens agora estão no lock gerenciado, por isso este mostra zero.",
          },
          {
            id: "rebase",
            term: "rebase",
            def: "Tokens novos pagos toda semana a quem tem lock, para compensar a diluição causada pelas emissões.",
          },
          {
            id: "votes",
            term: "votos",
            def: "Recompensas de voto: taxas de swap e incentivos dos pools em que este lock votou.",
          },
        ],
      },
      {
        id: "symbols",
        title: "Símbolos",
        terms: [
          {
            id: "dash",
            term: "—",
            def: "Não há número confiável para mostrar, então não mostramos nada em vez de chutar. Num preço, significa que nem nossas fontes de preço nem qualquer pool daquela rede conseguiram precificar o token. Passe o mouse sobre ele (ou toque nele) para ver qual foi o caso.",
          },
          {
            id: "dotted",
            term: "Sublinhado pontilhado",
            def: "Texto com sublinhado pontilhado tem uma explicação: passe o mouse sobre ele, ou toque nele no celular. A caixa Rendendo agora e os selos de um lock funcionam do mesmo jeito.",
          },
        ],
      },
    ],
  },
};

export default pages;
