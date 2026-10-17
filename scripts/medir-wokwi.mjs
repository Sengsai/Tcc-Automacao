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
  inicio=Date.now(); mono=performance.now()
  evento('inicio-coleta',{inicio,duracao,incluiInicializacao:true}); console.log('COLETA_INICIADA',new Date(inicio).toISOString())
  simulacao=spawn(exe,['--timeout',String(duracao+120000),'--timeout-exit-code','0',join(raiz,'firmware')],{env:{...process.env,WOKWI_CLI_TOKEN:token},stdio:['ignore','pipe','pipe']})
  let serialPendente=''
  simulacao.stdout.on('data', b=>{
    const texto=b.toString().replaceAll(token,'[SEGREDO]'); appendFileSync(join(saida,'serial.log'),texto)
    serialPendente+=texto
    const linhas=serialPendente.split('\n'); serialPendente=linhas.pop() ?? ''
    for(const linha of linhas) evento('serial',linha.replace(/\r$/,''))
  })
  simulacao.stderr.on('data',b=>{ const t=b.toString().replaceAll(token,'[SEGREDO]'); appendFileSync(join(saida,'wokwi-stderr.log'),t); evento('wokwi-stderr',t) })
  simulacao.on('error',e=>{terminou=true;evento('erro-wokwi',e.message)})
  simulacao.on('exit',(code,signal)=>{terminou=true;evento('fim-wokwi',{code,signal})})
  while(performance.now()-mono<duracao) {
    if(terminou) throw new Error('Simulação terminou antes do fim da janela; consultar os logs.')
    if(!ultimaValida && performance.now()-mono>120000) throw new Error('Sem leitura válida com NTP após dois minutos.')
    await dormir(Math.min(1000,duracao-(performance.now()-mono)))
  }
  const fim=Date.now(); evento('fim-coleta',{fim,duracaoRealMs:performance.now()-mono})
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
  const reconexoesEsp32=Math.max(0,conexoesEsp32-1)
  const reconexoesBackend=janela.filter(e=>e.tipo==='websocket' && e.dados.tipo==='conexao' && e.dados.broker.conectado).length
  const resumo={inicio,fim,inicioBrasilia:new Date(inicio).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),duracaoSolicitadaMs:duracao,broker:'broker.hivemq.com:1883',topico:'tcc-unip-7f3a9c/sala01/estado',demo:false,metricas,medianaMs:mediana,desvioPadraoPopulacionalMs:Math.sqrt(valores.reduce((s,v)=>s+(v-media)**2,0)/valores.length),latenciasNegativas:valores.filter(v=>v<0).length,reconexoesEsp32,reconexoesBackend,observacoes:['Latência depende da diferença entre relógios do PC e ESP32 sincronizado por NTP.','Perda estimada por lacunas de seq; não detecta perdas antes da primeira ou depois da última mensagem.','A janela de cinco minutos inclui inicialização e conexão; a primeira conexão do ESP32 não conta como reconexão. Backend já está conectado antes da janela.','O tópico e client ID do firmware são fixos; não executar outra instância desse firmware simultaneamente.']}
  writeFileSync(join(saida,'resumo.json'),JSON.stringify(resumo,null,2)+'\n')
  console.log('COLETA_CONCLUIDA',JSON.stringify(resumo))
} catch(e) {
  evento('falha',e.message); writeFileSync(join(saida,'falha.json'),JSON.stringify({erro:e.message,inicio,instante:Date.now()},null,2)); console.error(e.message); process.exitCode=1
} finally {
  simulacao?.kill(); ws?.terminate(); await servidor?.parar()
}
