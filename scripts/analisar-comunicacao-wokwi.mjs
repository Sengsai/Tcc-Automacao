import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const base = resolve(process.argv[2] ?? 'docs/experimentos/resultados/ct06-periodos-distintos')
const plano = JSON.parse(readFileSync(join(base, 'planejamento.json'), 'utf8'))
export function estatisticas(valores) {
  const xs = [...valores].sort((a, b) => a-b)
  if (!xs.length) return null
  if (xs.some(v => !Number.isFinite(v) || v < 0)) throw new Error('Tempo de resposta inválido.')
  const n = xs.length, media = xs.reduce((a,b)=>a+b,0)/n
  return { amostras:n, minMs:xs[0], mediaMs:media,
    medianaMs:n%2?xs[Math.floor(n/2)]:(xs[n/2-1]+xs[n/2])/2,
    desvioPadraoPopulacionalMs:Math.sqrt(xs.reduce((s,v)=>s+(v-media)**2,0)/n),
    p95Ms:xs[Math.ceil(.95*n)-1], maxMs:xs.at(-1) }
}
const execucoes = plano.periodos.map(p => {
  const pasta = join(base,p.pasta)
  if (!existsSync(join(pasta,'resumo.json'))) return {...p,status:'pendente'}
  const r=JSON.parse(readFileSync(join(pasta,'resumo.json'),'utf8'))
  const s=JSON.parse(readFileSync(join(pasta,'sondas-configuracao.json'),'utf8'))
  const eventos=readFileSync(join(pasta,'eventos.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l))
  const confirmacoesSemSonda=eventos.filter(e=>e.tipo==='confirmacao-sem-sonda').length
  if(confirmacoesSemSonda) throw new Error('Confirmação externa/sem sonda; revisar correlação: '+p.id)
  if (r.duracaoSolicitadaMs!==plano.duracaoAquisicaoMs || r.fim-r.inicio<plano.duracaoAquisicaoMs || r.incluiInicializacao) throw new Error('Janela diferente do protocolo: '+p.id)
  const atraso=r.inicio-Date.parse(p.previsto)
  if (atraso < -1000 || atraso > plano.atrasoMaximoInicioMs) throw new Error('Horário fora do previsto: '+p.id)
  if (!s.configuracaoPreservada) throw new Error('Configuração alterada: '+p.id)
  const valores=s.amostras.filter(a=>a.status==='confirmada').map(a=>a.rttMs)
  return {...p,status:'realizada',inicio:r.inicio,fim:r.fim,duracaoMs:r.fim-r.inicio,
    mensagens:r.metricas.perda.recebidas,perdaTelemetria:r.metricas.perda,
    reconexoesEsp32:r.reconexoesEsp32,reconexoesBackend:r.reconexoesBackend,
    diferencaTimestampsDiagnostica:{...r.metricas.latencia,medianaMs:r.medianaMs,desvioPadraoPopulacionalMs:r.desvioPadraoPopulacionalMs,negativas:r.latenciasNegativas},
    tempoRespostaComConfirmacaoSerial:estatisticas(valores),
    sondasEnviadas:s.amostras.length,sondasConfirmadas:valores.length,
    sondasSemConfirmacao:s.amostras.filter(a=>a.status!=='confirmada').length,
    configuracaoPreservada:s.configuracaoPreservada,confirmacoesSemSonda,sondasInterrompidasPorFalha:s.interrompidasPorFalha}
})
const feitas=execucoes.filter(e=>e.status==='realizada')
const medidas=feitas.filter(e=>e.tempoRespostaComConfirmacaoSerial)
const amplitude=campo=>medidas.length>1?Math.max(...medidas.map(e=>e.tempoRespostaComConfirmacaoSerial[campo]))-Math.min(...medidas.map(e=>e.tempoRespostaComConfirmacaoSerial[campo])):null
const analise={protocolo:'quatro minutos após primeira leitura NTP; três períodos distintos',
  concluida:feitas.length===3,execucoesRealizadas:feitas.length,
  falta:execucoes.filter(e=>e.status==='pendente').map(e=>e.id),
  observacao:'Tempo de resposta inclui REST local, MQTT de ida, processamento do ESP32 e retorno serial via Wokwi/CLI. Não é latência unidirecional, não é RTT exclusivamente MQTT, não dividir por dois e não comparar diretamente com 2791 ms.',
  execucoes,variacaoEntreExecucoes:{amplitudeDasMediasMs:amplitude('mediaMs'),amplitudeDasMedianasMs:amplitude('medianaMs'),amplitudeDosP95Ms:amplitude('p95Ms')}}
writeFileSync(join(base,'analise-comparativa.json'),JSON.stringify(analise,null,2)+'\n')
const cabecalho='periodo,status,inicioEpochMs,fimEpochMs,mensagens,minMs,mediaMs,medianaMs,desvioPadraoPopulacionalMs,p95Ms,maxMs,perdidas,taxaPerda,reconexoesEsp32,reconexoesBackend,sondasEnviadas,sondasConfirmadas,sondasSemConfirmacao'
const linhas=execucoes.map(e=>{const t=e.tempoRespostaComConfirmacaoSerial;return[e.id,e.status,e.inicio??'',e.fim??'',e.mensagens??'',t?.minMs??'',t?.mediaMs??'',t?.medianaMs??'',t?.desvioPadraoPopulacionalMs??'',t?.p95Ms??'',t?.maxMs??'',e.perdaTelemetria?.perdidas??'',e.perdaTelemetria?.taxa??'',e.reconexoesEsp32??'',e.reconexoesBackend??'',e.sondasEnviadas??'',e.sondasConfirmadas??'',e.sondasSemConfirmacao??''].join(',')})
writeFileSync(join(base,'comparacao-execucoes.csv'),cabecalho+'\n'+linhas.join('\n')+'\n')
console.log(JSON.stringify({concluida:analise.concluida,realizadas:feitas.length,falta:analise.falta}))
