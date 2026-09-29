// Tempo gasto no projeto, medido pelos transcritos do Claude Code.
//
//   npm run horas                → atualiza os dados deste computador e mostra o total
//   npm run horas -- --so-ler    → só mostra, sem ler os transcritos
//   npm run horas -- --nome "Computador 2"   → força o nome do computador
//
// Regra: soma os intervalos entre eventos consecutivos (mensagens, respostas,
// ferramentas) quando a pausa é de até PAUSA_MAX_MIN; pausa maior não conta.
// Os dados de cada computador ficam em privado/horas/<nome>.json (fora do
// GitHub, viaja pelo Drive com salvar/retomar). Cada rodada ACUMULA no arquivo,
// então o histórico sobrevive mesmo que o Claude Code apague transcritos velhos.
// O total junta todos os arquivos da pasta (união dos eventos: se dois
// computadores estiveram ativos ao mesmo tempo, o período conta uma vez só).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PAUSA_MAX_MIN = 60
const FUSO_H = -3 // Brasília, sem horário de verão
const raiz = path.resolve(import.meta.dirname, '..')
const pastaDados = path.join(raiz, 'privado', 'horas')

const args = process.argv.slice(2)
const soLer = args.includes('--so-ler')
const iNome = args.indexOf('--nome')
const nome =
  iNome >= 0
    ? args[iNome + 1]
    : raiz.toUpperCase().startsWith('D:')
      ? 'Computador 2'
      : 'Computador 1'
const arquivo = path.join(pastaDados, `${nome.toLowerCase().replace(/\s+/g, '-')}.json`)

fs.mkdirSync(pastaDados, { recursive: true })
const ler = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null)

// ---- 1. atualizar os dados deste computador a partir dos transcritos ----
if (!soLer) {
  const dir = path.join(os.homedir(), '.claude', 'projects', raiz.replace(/[^A-Za-z0-9]/g, '-'))
  const eventos = new Set()
  const interacoes = new Set()
  const atual = ler(arquivo)
  if (atual) {
    atual.eventos.forEach((t) => eventos.add(t))
    atual.interacoes.forEach((t) => interacoes.add(t))
  }
  if (!fs.existsSync(dir)) {
    console.log(`(aviso) pasta de transcritos não encontrada: ${dir}`)
  } else {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
      for (const linha of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
        if (!linha) continue
        let j
        try {
          j = JSON.parse(linha)
        } catch {
          continue
        }
        if (!j.timestamp) continue
        const t = Math.floor(Date.parse(j.timestamp) / 1000)
        eventos.add(t)
        if (j.type === 'user' && !j.isMeta && !j.isSidechain) {
          const c = j.message?.content
          const txt =
            typeof c === 'string'
              ? c
              : Array.isArray(c)
                ? c.filter((x) => x.type === 'text').map((x) => x.text).join('')
                : ''
          if (
            txt &&
            !txt.startsWith('<system-reminder') &&
            !txt.startsWith('<command-') &&
            !txt.startsWith('<local-command') &&
            !txt.includes('<ci-monitor-event')
          )
            interacoes.add(t)
        }
      }
    }
  }
  const ord = (s) => [...s].sort((a, b) => a - b)
  fs.writeFileSync(
    arquivo,
    JSON.stringify({ computador: nome, atualizadoEm: new Date().toISOString(), eventos: ord(eventos), interacoes: ord(interacoes) }),
  )
}

// ---- 2. relatório juntando todos os computadores ----
const arquivos = fs.readdirSync(pastaDados).filter((f) => f.endsWith('.json'))
const dados = arquivos.map((f) => ler(path.join(pastaDados, f)))
const dia = (t) => new Date((t + FUSO_H * 3600) * 1000).toISOString().slice(0, 10)

function horasAtivas(ts, porDia) {
  const o = [...ts].sort((a, b) => a - b)
  let total = 0
  for (let i = 1; i < o.length; i++) {
    const d = o[i] - o[i - 1]
    if (d <= PAUSA_MAX_MIN * 60) {
      total += d
      if (porDia) porDia[dia(o[i])] = (porDia[dia(o[i])] || 0) + d
    }
  }
  return total / 3600
}

const todos = new Set()
const todasInter = new Set()
console.log(`Pausa máxima considerada: ${PAUSA_MAX_MIN} min · fuso: Brasília\n`)
for (const d of dados) {
  d.eventos.forEach((t) => todos.add(t))
  d.interacoes.forEach((t) => todasInter.add(t))
  console.log(
    `${d.computador.padEnd(14)} ${horasAtivas(d.eventos).toFixed(1).padStart(6)} h · ${String(d.interacoes.length).padStart(4)} interações · até ${new Date(d.eventos.at(-1) * 1000).toISOString().slice(0, 10)}`,
  )
}
const porDia = {}
const total = horasAtivas(todos, porDia)
const interDia = {}
todasInter.forEach((t) => (interDia[dia(t)] = (interDia[dia(t)] || 0) + 1))

console.log('\nDia         Horas  Interações')
for (const d of Object.keys({ ...porDia, ...interDia }).sort()) {
  console.log(`${d}  ${((porDia[d] || 0) / 3600).toFixed(1).padStart(5)}  ${String(interDia[d] || 0).padStart(5)}`)
}
console.log(`\nTOTAL (união de ${dados.length} computador${dados.length > 1 ? 'es' : ''}): ${total.toFixed(1)} h · ${todasInter.size} interações · ${Object.keys(porDia).length} dias com atividade`)

// ---- 3. custos: tabela-base (privado/custos.json) → totais públicos ----
// A tabela tem valor da hora e detalhe por item, então fica em privado/ (o repo
// é público). O site só recebe os totais, em app/custos-total.json, que vai
// para o git: rode `npm run horas` e commite esse arquivo para atualizá-lo.
const arqCustos = path.join(raiz, 'privado', 'custos.json')
if (fs.existsSync(arqCustos)) {
  const custos = ler(arqCustos)
  if (args.includes('--cotacao')) {
    const r = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL')
    const j = await r.json()
    custos.brlPorUsd = j.rates.BRL
    custos.cotacaoData = j.date
    fs.writeFileSync(arqCustos, JSON.stringify(custos, null, 2) + '\n')
  }
  const agora = new Date(Date.now() + FUSO_H * 3600 * 1000)
  const [ai, am] = custos.assinaturaInicio.split('-').map(Number)
  // meses de assinatura: do mês de início até o mês corrente, ambos inclusos
  const meses = (agora.getUTCFullYear() - ai) * 12 + (agora.getUTCMonth() + 1 - am) + 1
  const usd = (brl) => brl / custos.brlPorUsd
  const fmt = (n) => n.toFixed(2).padStart(9)
  let totalBrl = 0
  console.log(`\nCUSTOS — câmbio R$ ${custos.brlPorUsd} por US$ (${custos.cotacaoData}); valores em US$`)
  console.log('Tipo         Unidade   Valor      Qtd     Total  Destino')
  for (const l of custos.linhas) {
    const qtd = l.quantidade === 'horas' ? Math.round(total * 10) / 10 : l.quantidade === 'meses' ? meses : l.quantidade
    const t = l.valor * qtd
    totalBrl += t
    console.log(`${l.tipo.padEnd(12)} ${l.unidade.padEnd(7)} ${fmt(usd(l.valor))} ${String(qtd).padStart(7)} ${fmt(usd(t))}  ${l.destino}`)
  }
  console.log(`TOTAL: US$ ${usd(totalBrl).toFixed(2)} (R$ ${totalBrl.toFixed(2)})`)
  fs.writeFileSync(
    path.join(raiz, 'app', 'custos-total.json'),
    JSON.stringify({ horas: Math.round(total * 10) / 10, totalUsd: Math.round(usd(totalBrl)), atualizadoEm: agora.toISOString().slice(0, 10) }, null, 2) + '\n',
  )
  console.log('→ app/custos-total.json atualizado (commite para o site refletir)')
}
