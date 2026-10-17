import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { parseEnv } from 'node:util'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
import { criarServidor } from '../apps/backend/src/servidor.ts'
const raiz = resolve(import.meta.dirname, '..')
const require = createRequire(join(raiz, 'apps/backend/package.json'))
const { WebSocket } = require('ws')
const arg = (nome, padrao) => { const i = process.argv.indexOf(nome); return i < 0 ? padrao : process.argv[i + 1] }
const duracao = Number(arg('--duracao-ms', '300000'))
const sondasHabilitadas = process.argv.includes('--sondas-configuracao')
const aposPrimeiraLeitura = process.argv.includes('--apos-primeira-leitura')
const saida = resolve(arg('--saida', join(raiz, 'docs/experimentos/resultados/wokwi', new Date().toISOString().replaceAll(':','-'))))
if (!(duracao > 0 && duracao <= 300000)) throw new Error('Duração deve ser maior que zero e no máximo cinco minutos.')
if (existsSync(saida)) throw new Error('A pasta de saída já existe; não sobrescrever resultados.')
const token = process.env.WOKWI_CLI_TOKEN ?? parseEnv(readFileSync(resolve(arg('--env', join(raiz, '.env'))), 'utf8')).WOKWI_CLI_TOKEN
if (!token) throw new Error('Token ausente.')
if (!existsSync(join(raiz,'firmware/.pio/build/esp32dev/firmware.bin'))) throw new Error('Firmware ainda não compilado.')
mkdirSync(saida, { recursive: true })
const dados = join(saida, 'backend')
mkdirSync(dados)
writeFileSync(join(dados,'configuracoes.json'), JSON.stringify({broker:{modo:'externo',host:'broker.hivemq.com',porta:1883,raiz:'tcc-unip-7f3a9c'},demo:false}))
const eventos = []
function evento(tipo, dados) { const e={recebidoEm:Date.now(),tipo,dados}; eventos.push(e); appendFileSync(join(saida,'eventos.jsonl'),JSON.stringify(e)+'\n') }
const dormir = ms => new Promise(r=>setTimeout(r,ms))
let servidor, ws, simulacao
let ultimaValida=0, terminou=false, inicio=0, mono=0
const sondas = []
let sondaPendente = null, tarefaSonda = null, proximaSonda = 0, interromperSondas = false
let configAntes = null
const LIMITE_SONDA_MS = 15000

// {} é aceito pelo contrato e não modifica nenhum parâmetro. A confirmação já
// existe no firmware. O caminho medido termina na recepção serial pelo CLI:
// REST local -> MQTT público -> callback ESP32 -> serial/Wokwi -> computador.
// Não é RTT exclusivamente MQTT nem a latência unidirecional de telemetria.
async function sondarConfiguracao() {
  const id = sondas.length + 1
  const enviadoEm = Date.now(), inicioMono = performance.now()
  let limite
  const confirmacao = new Promise((resolve, reject) => {
    limite = setTimeout(() => reject(new Error('Confirmação não recebida em 15 s.')), LIMITE_SONDA_MS)
    sondaPendente = { resolve }
  })
  evento('sonda-iniciada', { id, enviadoEm, payload: {} })
  try {
    const [http, ack] = await Promise.all([
      fetch(`${servidor.url}/api/dispositivos/sala01/config`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
        signal: AbortSignal.timeout(LIMITE_SONDA_MS),
      }),
      confirmacao,
    ])
    if (!http.ok) throw new Error(`HTTP ${http.status} ao enviar configuração vazia.`)
    const resposta = await http.json()
    if (JSON.stringify(resposta) !== JSON.stringify(configAntes)) throw new Error('A configuração conhecida foi alterada; interromper sondas.')
    const amostra = { id, enviadoEm, confirmadoEm: ack.em, rttMs: ack.mono - inicioMono, status: 'confirmada', serial: ack.linha }
    sondas.push(amostra)
    evento('sonda-concluida', amostra)
  } catch (erro) {
    const amostra = { id, enviadoEm, confirmadoEm: null, rttMs: null, status: 'falha', erro: erro.message }
    sondas.push(amostra)
    evento('sonda-falhou', amostra)
    // Não lançar outra sonda após timeout: uma confirmação atrasada não pode
    // ser atribuída à sonda seguinte. Há no máximo uma solicitação em trânsito.
    interromperSondas = true
  } finally {
    clearTimeout(limite)
    sondaPendente = null
  }
}
try {
  servidor = await criarServidor({dirDados:dados,portaHttp:0})
  ws = new WebSocket(servidor.url.replace('http:','ws:')+'/ws')
  ws.on('message', corpo => {
    const m=JSON.parse(corpo.toString()); evento('websocket',m)
    if(m.tipo==='estado' && m.dados.dispositivo==='sala01' && m.dados.ts>0) ultimaValida=Date.now()
  })
  ws.on('error', e=>evento('erro-websocket', e.message))
  ws.on('close', ()=>evento('fim-websocket',null))
  let saude
  for(let n=0;n<30;n++) {
    saude=await (await fetch(servidor.url+'/api/saude')).json()
    if(saude.broker.modo==='externo' && saude.broker.conectado && !saude.demo && ws.readyState===1) break
    await dormir(1000)
  }
  if(!saude?.broker.conectado || saude.demo || ws.readyState!==1) throw new Error('Backend não conectou ao broker público.')
  const exe=arg('--wokwi','wokwi-cli')
  // A janela inclui a inicialização: o plano gratuito limita a sessão inteira a cinco minutos.
  const inicioSessao = Date.now()
  evento('inicio-sessao', { inicioSessao, aposPrimeiraLeitura })
  if (!aposPrimeiraLeitura) {
    inicio=Date.now(); mono=performance.now()
    evento('inicio-coleta',{inicio,duracao,incluiInicializacao:true}); console.log('COLETA_INICIADA',new Date(inicio).toISOString())
  }
  simulacao=spawn(exe,['--timeout',String(duracao+120000),'--timeout-exit-code','0',join(raiz,'firmware')],{env:{...process.env,WOKWI_CLI_TOKEN:token},stdio:['ignore','pipe','pipe']})
  let serialPendente=''
  simulacao.stdout.on('data', b=>{
    const texto=b.toString().replaceAll(token,'[SEGREDO]'); appendFileSync(join(saida,'serial.log'),texto)
    serialPendente+=texto
    const linhas=serialPendente.split('\n'); serialPendente=linhas.pop() ?? ''
    for(const original of linhas) {
      const linha = original.replace(/\r$/,'')
      evento('serial', linha)
      if (sondasHabilitadas && linha.startsWith('[mqtt] config:')) {
        if (sondaPendente) sondaPendente.resolve({ em: Date.now(), mono: performance.now(), linha })
        else evento('confirmacao-sem-sonda', { linha })
      }
    }
  })
  simulacao.stderr.on('data',b=>{ const t=b.toString().replaceAll(token,'[SEGREDO]'); appendFileSync(join(saida,'wokwi-stderr.log'),t); evento('wokwi-stderr',t) })
  simulacao.on('error',e=>{terminou=true;evento('erro-wokwi',e.message)})
  simulacao.on('exit',(code,signal)=>{terminou=true;evento('fim-wokwi',{code,signal})})
  if (aposPrimeiraLeitura) {
    const limiteAquecimento = performance.now() + 45000
    while (!ultimaValida && !terminou && performance.now() < limiteAquecimento) await dormir(100)
    if (!ultimaValida || terminou) throw new Error('Sem primeira leitura válida nos 45 s de aquecimento.')
    inicio=Date.now(); mono=performance.now()
    evento('inicio-coleta', { inicio, duracao, incluiInicializacao: false, inicioSessao })
    console.log('COLETA_INICIADA',new Date(inicio).toISOString())
  }
  while(performance.now()-mono<duracao) {
    if(terminou) throw new Error('Simulação terminou antes do fim da janela; consultar os logs.')
    if(!ultimaValida && performance.now()-mono>120000) throw new Error('Sem leitura válida com NTP após dois minutos.')
    const agoraMono = performance.now()
    if (sondasHabilitadas && ultimaValida && !sondaPendente && !interromperSondas && agoraMono >= proximaSonda && duracao-(agoraMono-mono)>LIMITE_SONDA_MS+1000) {
      if (configAntes === null) {
        const estado = await (await fetch(`${servidor.url}/api/dispositivos/sala01/estado`)).json()
        configAntes = estado.config
      }
      proximaSonda = agoraMono + 10000
      tarefaSonda = sondarConfiguracao()
    }
    await dormir(Math.min(1000,duracao-(performance.now()-mono)))
  }
  const fim=Date.now(); evento('fim-coleta',{fim,duracaoRealMs:performance.now()-mono})
  if (tarefaSonda) await tarefaSonda
  if (sondasHabilitadas) {
    const estado = await (await fetch(`${servidor.url}/api/dispositivos/sala01/estado`)).json()
    writeFileSync(join(saida,'sondas-configuracao.json'), JSON.stringify({
      caminho: 'REST local -> MQTT publico -> ESP32 -> serial Wokwi/CLI -> computador',
      relogio: 'performance.now no mesmo processo', payload: {}, intervaloMinimoMs: 10000,
      limiteConfirmacaoMs: LIMITE_SONDA_MS, correlacao: 'ordem; uma sonda em transito; interromper apos qualquer falha',
      configuracaoAntes: configAntes, configuracaoDepois: estado.config,
      configuracaoPreservada: JSON.stringify(configAntes) === JSON.stringify(estado.config),
      interrompidasPorFalha: interromperSondas, amostras: sondas,
    },null,2)+'\n')
    writeFileSync(join(saida,'sondas-configuracao.csv'), 'id,enviadoEm,confirmadoEm,rttMs,status\n'+sondas.map(s=>[s.id,s.enviadoEm,s.confirmadoEm??'',s.rttMs??'',s.status].join(',')).join('\n')+'\n')
  }
  const periodo=`de=${inicio}&ate=${fim}`
  const resposta=await fetch(`${servidor.url}/api/dispositivos/sala01/export.csv?${periodo}`)
  if(!resposta.ok) throw new Error('Falha na exportação CSV.')
  const csv=await resposta.text(); writeFileSync(join(saida,'leituras.csv'),csv)
  const metricas=await (await fetch(`${servidor.url}/api/dispositivos/sala01/metricas?${periodo}`)).json()
  const linhas=csv.trim().split('\n').slice(1).map(l=>l.split(','))
  const valores=linhas.filter(l=>l[4]!=='').map(l=>Number(l[4])).sort((a,b)=>a-b)
  if(!valores.length) throw new Error('Nenhuma amostra de latência válida.')
  const media=valores.reduce((a,b)=>a+b,0)/valores.length
  const meio=Math.floor(valores.length/2)
  const mediana=valores.length%2?valores[meio]:(valores[meio-1]+valores[meio])/2
  const janela=eventos.filter(e=>e.recebidoEm>=inicio && e.recebidoEm<=fim)
  const conexoesEsp32=janela.filter(e=>e.tipo==='serial' && e.dados.includes('[mqtt] conectado')).length
  const reconexoesEsp32=Math.max(0,conexoesEsp32-(aposPrimeiraLeitura?0:1))
  const reconexoesBackend=janela.filter(e=>e.tipo==='websocket' && e.dados.tipo==='conexao' && e.dados.broker.conectado).length
  const resumo={inicio,fim,inicioBrasilia:new Date(inicio).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),duracaoSolicitadaMs:duracao,broker:'broker.hivemq.com:1883',topico:'tcc-unip-7f3a9c/sala01/estado',demo:false,metricas,medianaMs:mediana,desvioPadraoPopulacionalMs:Math.sqrt(valores.reduce((s,v)=>s+(v-media)**2,0)/valores.length),latenciasNegativas:valores.filter(v=>v<0).length,reconexoesEsp32,reconexoesBackend,observacoes:['Latência depende da diferença entre relógios do PC e ESP32 sincronizado por NTP.','Perda estimada por lacunas de seq; não detecta perdas antes da primeira ou depois da última mensagem.','A janela de cinco minutos inclui inicialização e conexão; a primeira conexão do ESP32 não conta como reconexão. Backend já está conectado antes da janela.','O tópico e client ID do firmware são fixos; não executar outra instância desse firmware simultaneamente.']}
  resumo.inicioSessao = inicioSessao
  resumo.incluiInicializacao = !aposPrimeiraLeitura
  resumo.sondasConfiguracaoHabilitadas = sondasHabilitadas
  if (aposPrimeiraLeitura) resumo.observacoes[2] = 'A janela começa após a primeira leitura com NTP; aquecimento máximo de 45 s. Reconexões excluem a partida inicial.'
  writeFileSync(join(saida,'resumo.json'),JSON.stringify(resumo,null,2)+'\n')
  console.log('COLETA_CONCLUIDA',JSON.stringify(resumo))
} catch(e) {
  evento('falha',e.message); writeFileSync(join(saida,'falha.json'),JSON.stringify({erro:e.message,inicio,instante:Date.now()},null,2)); console.error(e.message); process.exitCode=1
} finally {
  simulacao?.kill(); ws?.terminate(); await servidor?.parar()
}
