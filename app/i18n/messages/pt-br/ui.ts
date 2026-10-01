/**
 * Textos da interface em português do Brasil. O TypeScript obriga este objeto
 * a ter as mesmas chaves do inglês (`../en/ui.ts`).
 *
 * Glossário fixo (manter igual em todo o site):
 *   claimable → "a resgatar" · fees → "taxas" · earning now → "rendendo agora"
 *   range → "faixa" · in/out of range → "dentro/fora da faixa"
 *   staked → "em stake" · gauge, lock, NFT, APR, pool → ficam como estão
 *   emissions → "emissões" · tip → "gorjeta" · read-only → "somente leitura"
 * Nomes de rede, protocolos, tokens e "DefiLlama" nunca se traduzem.
 */

import type { Plural } from "../../rich";
import type { UiMessages } from "../en/ui";

const ui: UiMessages = {
  common: {
    dash: "—",
    chainFallback: "rede {id}",
  },

  header: {
    readOnly: "Somente leitura · nunca pedimos chaves",
    language: "Idioma",
  },

  costbar: {
    aria: "Custo de construir o trackdefi",
    line: {
      one: "Até agora, este site consumiu cerca de {n} hora de trabalho e US$ {usd} para ser construído e mantido.",
      other: "Até agora, este site consumiu cerca de {n} horas de trabalho e US$ {usd} para ser construído e mantido.",
    } as Plural,
    tips: "Gorjetas são opcionais:",
    copyAria: "Copiar endereço para gorjetas",
    copy: "Copiar",
    copied: "Copiado ✓",
  },

  donate: {
    aria: "Apoie o trackdefi",
    tipJar: "Cofrinho de gorjetas",
    note: "O mesmo endereço em qualquer rede EVM · sempre opcional",
    copyAria: "Copiar endereço para gorjetas",
    copy: "Copiar",
    copied: "Copiado ✓",
    phrases: [
      "Grátis e somente leitura, sempre. Se poupou seu tempo hoje, uma gorjeta o mantém no ar.",
      "Feito por uma pessoa e mantido por quem usa. Gorjetas são opcionais — e muito bem-vindas.",
      "Cada consulta lê várias blockchains ao mesmo tempo. Gorjetas ajudam a pagar os nós.",
      "Sem login, sem assinatura. Se esta página ajudou, que tal pagar um café ao dev?",
      "Achou uma posição que tinha esquecido? Que tal dar uma gorjeta a quem a encontrou?",
      "Suas gorjetas financiam as próximas redes e corretoras do roadmap.",
      "Acompanhar LPs não deveria custar nada. Manter o site no ar custa — gorjetas ajudam.",
      "Se o trackdefi mora nos seus favoritos, uma gorjeta pequena ajuda a mantê-lo no ar.",
      "Já resgatou as taxas? Uma fatiazinha como gorjeta faz muita diferença aqui.",
      "Independente e gratuito. As gorjetas são o que o mantém assim.",
      "Números honestos dão trabalho. Uma gorjeta é um jeito de agradecer.",
      "Fora da faixa? A gente avisa. Gorjetas ajudam a continuar avisando.",
      "Um endereço, todas as posições — e um endereço para gorjetas, se quiser.",
      "Gorjetas pagam servidores e nós de blockchain, para o site seguir rápido e gratuito.",
      "Poupou uma volta por cinco exploradores de bloco? Uma gorjeta é sempre bem-vinda.",
      "Gostando do trackdefi? Uma gorjeta voluntária ajuda a fazê-lo crescer.",
      "Quer uma rede nova mais cedo? Gorjetas transformam itens do roadmap em recursos.",
      "Gorjeta pequena, ajuda grande: cada uma vai direto para manter o trackdefi no ar.",
      "Gosta de ver suas taxas crescendo? Ajude o site a crescer também — gorjetas bem-vindas.",
      "Grátis para todos, mantido por poucos. Quer ser um desses poucos?",
      "Conferiu suas LPs em segundos? É essa a ideia. Uma gorjeta ajuda a mantê-lo gratuito.",
      "Foi útil hoje? Gorjetas, mesmo pequenas, mantêm o trackdefi independente.",
      "Toda gorjeta vira servidor, nó e recurso novo. Obrigado!",
      "Emissões ficam pendentes; gratidão se resgata a qualquer hora. Gorjetas bem-vindas.",
      "Sua faixa tem limite; nosso agradecimento por uma gorjeta, não.",
      "O valor de um cafezinho em ETH mantém este site funcionando.",
      "Se isto poupou uma planilha sua, considere uma gorjeta.",
      "Posições em stake, achadas. Taxas pendentes, contadas. Gorjetas, recebidas com gratidão.",
      "Não precisa de conta para usar — nem para apoiar.",
      "Por trás de cada atualização há uma conta de servidor. Gorjetas ajudam a pagá-la.",
    ],
  },

  footer: {
    safety:
      "O <b>{name}</b> lê apenas dados públicos da blockchain. Nunca pede chaves privadas nem frases de recuperação, e não consegue mover fundos. <link>Como funciona e por que é seguro →</link>",
    disclaimer:
      "Não é recomendação financeira. Confira os dados na blockchain antes de agir. Preços da DefiLlama e da DexScreener, ou lidos dos próprios pools.",
    coverage:
      "Cobertura: {list} — <roadmap>veja o roadmap</roadmap> · <changelog>novidades</changelog> · <glossary>o que significa cada número</glossary>.",
    feedback: "Feedback",
  },

  search: {
    placeholder: "Cole o endereço de uma carteira (0x…)",
    aria: "Endereço da carteira",
    invalid: "Isso não parece um endereço de carteira. Cole o endereço completo, 0x… (42 caracteres).",
    submit: "Ver posições",
    opening: "Abrindo…",
  },

  tapTips: { close: "Fechar" },

  wallet: {
    copyAddress: "Copiar endereço",
    copied: "Copiado ✓",
    refresh: "Atualizar",
    scanning: "Varrendo as blockchains…",
    scanningBody:
      "Lendo Aerodrome, Velodrome e Uniswap v3 em {networks} — posições clássicas, concentradas e em stake nos gauges.",
    elapsed: "{secs}s — a primeira varredura completa leva cerca de 15 s",
    errors: {
      invalid_address: { title: "Endereço inválido", body: "Isso não parece um endereço de carteira válido." },
      rate_limited: { title: "Requisições demais", body: "Aguarde alguns segundos e tente de novo." },
      timeout: { title: "A blockchain demorou demais", body: "A rede está lenta agora. Tente de novo daqui a pouco." },
      upstream: { title: "Não conseguimos acessar a blockchain", body: "Um soluço de rede do nosso lado. Tente de novo daqui a pouco." },
      busy: { title: "Servidor ocupado", body: "Estamos varrendo outras carteiras agora. Tente de novo em alguns segundos." },
      network: { title: "Problema de conexão", body: "Verifique sua conexão com a internet e tente de novo." },
    },
    tryAgain: "Tentar de novo",
    invalidAddress: {
      title: "Endereço inválido",
      body: "“{address}” não é um endereço de carteira válido.",
      back: "Voltar à busca",
    },
    empty: {
      title: "Nenhuma posição de liquidez encontrada",
      body: "Esta carteira não tem posições ativas na Aerodrome, Velodrome ou Uniswap v3 em {networks} no momento.",
      another: "Ver outra carteira",
    },
    kpi: {
      totalInPools: "Total em pools",
      positionsWithoutPrice: {
        one: "+ {n} posição sem preço confiável",
        other: "+ {n} posições sem preço confiável",
      },
      locked: "Bloqueado",
      lockedHint: "locks de governança {tokens}",
      claimable: "Recompensas a resgatar",
      claimableHintLocks: "taxas, emissões e recompensas de lock",
      claimableHint: "taxas + emissões",
      rewardsWithoutPrice: {
        one: "+ {n} recompensa sem preço confiável",
        other: "+ {n} recompensas sem preço confiável",
      },
      positions: "Posições",
      scannedIn: "varridas em {s} s",
    },
    glossaryLink: "O que significam estes números? →",
    showingTop: "Mostrando as {shown} maiores posições por valor (de {total}). Os totais incluem todas.",
    refreshToRetry: "Atualize para tentar de novo.",
    sectionLocks: "Locks de governança",
    sectionPositions: "Posições de liquidez",
  },

  card: {
    kind: {
      concentrated: "Concentrada",
      v2stable: "Clássica · estável",
      v2volatile: "Clássica · volátil",
    },
    viewPool: "Ver o pool em {explorer}",
    theExplorer: "o explorador de blocos",
    inRange: "✓ Dentro da faixa",
    outOfRange: "⚠ Fora da faixa",
    staked: "Em stake no gauge",
    alm: "Gerida por ALM",
    nft: "NFT #{id}",
    earningNow: "Rendendo agora",
    poolShort: "pool {pct}",
    poolRef: " · pool {pct}",
    lastWindow: "Últimas {window}",
    perYear: "{pct}/ano",
    inFees: "{usd} em taxas",
    emissions: "Emissões",
    currentRate: "taxa atual",
    partFees: "taxas {pct}",
    partEmissions: "emissões {pct}",
    outOfRangeSub: "fora da faixa",
    justOpenedSub: "recém-aberta · primeira leitura em ~15 min",
    tipWindows:
      "Taxas de swap que esta posição realmente ganhou, medidas no contrato do pool. Cada linha mostra uma janela de medição: a taxa é anualizada, e o valor em dólar é o que foi ganho dentro daquela janela. Uma janela curta bem acima da longa significa que o pool está movimentado agora.",
    tipPoolAvg: "Média do pool, considerando toda a liquidez dentro da faixa: {pct}/ano ({source}).",
    tipOutOfRange:
      "Fora da faixa: esta posição não está ganhando taxas de swap agora. As taxas já acumuladas continuam disponíveis para resgate.",
    tipOutOfRangeStaked:
      "Fora da faixa: esta posição não está ganhando taxas de swap agora e as emissões do gauge estão pausadas. As taxas já acumuladas continuam disponíveis para resgate.",
    tipPoolInRange: "A liquidez dentro da faixa neste pool rende em média {pct}/ano ({source}).",
    tipEstimate: "Rendimento estimado que ESTA posição está tendo agora ({parts}).",
    tipEstimateNote: "Estimativa a partir de dados ao vivo do pool — não é um retorno já realizado.",
    tipJustOpened:
      "Esta posição foi aberta há instantes. As taxas são medidas numa janela, e a menor janela que o site usa é de 15 minutos — então a primeira leitura aparece quando a posição tiver idade para preenchê-la.",
    earningLine: "Rendendo agora <b>{pct}</b>",
    poolAprLine: "APR do pool <b>{pct}</b>",
    poolAprSub: "média 30d {mean} · {source}",
    poolAprTip:
      "APR do pool — taxas: {base} · recompensas: {reward} · média de 30 dias: {mean}. É uma característica do pool, não o seu retorno pessoal. Fonte: {source}.",
    claimable: "A resgatar",
    rewardEmission: "emissões",
    rewardFee: "taxas",
    totalClaimable: "Total a resgatar",
  },

  lock: {
    badge: "Lock de governança",
    managed: "Em lock gerenciado #{id}",
    managedTip:
      "Este lock foi depositado num lock gerenciado (um relay). Os tokens agora estão nesse lock gerenciado, por isso este mostra zero bloqueado.",
    permanent: "Lock permanente",
    permanentTip: "Bloqueado para sempre: o poder de voto não decai e não há data de desbloqueio.",
    expired: "⚠ Vencido — pode sacar",
    expiredTip:
      "Este lock venceu em {date}. Os tokens ainda estão nele, mas já podem ser sacados — e ele não tem mais poder de voto.",
    unlocks: "Desbloqueia em {date}",
    unlocksTip: "O poder de voto decai linearmente até esta data, quando os tokens podem ser sacados.",
    locked: "{symbol} bloqueado",
    votingPower: "Poder de voto",
    votingPowerTip: "Poder de voto atual. Ele decai até zero conforme a data de desbloqueio se aproxima.",
    claimable: "A resgatar",
    rebase: "rebase",
    votes: "votos",
    rebaseTip: "Rebase: tokens novos pagos toda semana a quem tem lock, para compensar a diluição das emissões.",
    votesTip: "Recompensas de voto: taxas de swap e incentivos dos pools em que este lock votou.",
    totalClaimable: "Total a resgatar",
  },

  range: {
    ariaIn: "Faixa de preço de {lower} a {upper} {quote}, atual {current}, dentro da faixa",
    ariaOut: "Faixa de preço de {lower} a {upper} {quote}, atual {current}, fora da faixa",
    now: "agora {price}",
    deltasTip: "Quanto o preço precisa se mover, a partir de agora, para chegar a cada extremo da faixa",
  },

  notices: {
    source: "Não conseguimos ler {where} — as posições de lá estão faltando nesta lista.",
    partial: "Alguns dados de {where} não carregaram, então uma posição ou recompensa pode estar faltando.",
    locks: "Não conseguimos ler os locks de governança em {where}.",
    prices: "O serviço de preços não respondeu para alguns tokens, então os valores em dólar deles aparecem como \"—\".",
    apr: "Os dados de APR do pool não carregaram, então as médias dos pools aparecem como \"—\".",
    fees: {
      one: "A medição ao vivo das taxas não estava disponível para {n} posição — a taxa dela é estimada a partir de dados gerais do pool, quando possível.",
      other:
        "A medição ao vivo das taxas não estava disponível para {n} posições — a taxa delas é estimada a partir de dados gerais do pool, quando possível.",
    },
    capped:
      "Esta carteira tem uma quantidade enorme de NFTs de posição em {where}; só {checked} foram verificados.",
    hooks: {
      one: "{n} posição em {where} está num pool com hook personalizado — recompensas extras pagas pelo hook não são contadas.",
      other:
        "{n} posições em {where} estão num pool com hook personalizado — recompensas extras pagas pelo hook não são contadas.",
    },
    where: "{protocol} em {network}",
    thisToken: "este token",
    noPriceFailed:
      "Sem preço em USD para {who} agora — ou nossa fonte de preços não cobre {them}, ou ela não respondeu desta vez (veja o aviso acima).",
    noPrice:
      "Sem preço confiável em USD para {who} — nossa fonte de preços não cobre {them}, então {they} sem valor em dólar, em vez de um palpite. Isto não é um erro; atualizar não muda isso.",
    itOne: "este token",
    itMany: "estes tokens",
    getsOne: "ele fica",
    getsMany: "eles ficam",
    poolPrice:
      "Preço tirado de um pool: nossas fontes de preços não cobrem {symbol}, então este é o preço de {symbol} dentro de um pool desta rede agora — o pool da própria posição, sempre que possível. Um pool pequeno ou raso pode precificá-lo diferente de outros mercados.",
    summaryPositions:
      "Estas posições têm um token que nossa fonte de preços não cobre, então ficam fora do total em vez de serem chutadas.",
    summaryRewards:
      "Algumas recompensas a resgatar não têm preço na nossa fonte de preços, então ficam fora deste total em vez de serem chutadas. As quantidades estão listadas em cada card.",
    summaryFailed:
      "O serviço de preços também não respondeu para alguns tokens desta vez — atualizar pode trazê-los de volta.",
    summaryNotError: "Isto não é um erro; atualizar não muda isso.",
  },

  feedback: {
    errors: {
      message_too_short: "Escreva mais algumas palavras, por favor.",
      message_too_long: "Mantenha abaixo de {max} caracteres, por favor.",
      invalid_email: "Esse e-mail não parece correto.",
      rate_limited: "Mensagens demais seguidas — aguarde alguns minutos, por favor.",
    },
    generic: "Não foi possível enviar agora. Tente de novo daqui a pouco.",
    sentTitle: "Obrigado — mensagem recebida.",
    sentWithEmail: "Toda mensagem é lida por uma pessoa. Se precisar de resposta, responderemos ao e-mail que você deixou.",
    sentNoEmail:
      "Toda mensagem é lida por uma pessoa. Você não deixou e-mail, então não podemos responder — mas ela conta do mesmo jeito.",
    sendAnother: "Enviar outra",
    messageLabel: "Sua mensagem",
    messagePlaceholder: "Uma ideia, uma rede que você gostaria de ver, uma posição que não mostramos, algo que parece errado…",
    emailLabel: "Seu e-mail <em>(opcional — só se quiser resposta)</em>",
    emailPlaceholder: "voce@exemplo.com",
    honeypot: "Website",
    send: "Enviar",
    sending: "Enviando…",
  },

  dates: {
    months: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
    format: "{d} {m} {y}",
    minutes: "{n} min",
    hours: "{n} h",
  },
};

export default ui;
