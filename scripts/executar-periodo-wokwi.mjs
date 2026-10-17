// Executa somente o período autorizado que esteja no horário; não espera horas
// nem transforma uma execução perdida em uma coleta no mesmo período de outra.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, join, sep } from 'node:path'

const raiz=resolve(import.meta.dirname,'..')
const arg=(nome,padrao)=>{const i=process.argv.indexOf(nome);return i<0?padrao:process.argv[i+1]}
const base=join(raiz,'docs/experimentos/resultados/ct06-periodos-distintos')
const plano=JSON.parse(readFileSync(join(base,'planejamento.json'),'utf8'))
const agora=Date.now()
const periodo=plano.periodos.find(p=>agora>=Date.parse(p.previsto)&&agora-Date.parse(p.previsto)<=plano.atrasoMaximoInicioMs)
if (!periodo) { console.log('Nenhum período autorizado está na janela de início agora.'); process.exit(0) }
const pasta=join(base,periodo.pasta)
function registrarRelogio(nome) {
  if (process.platform!=='win32') {writeFileSync(join(base,nome+'.json'),JSON.stringify({instante:Date.now(),consulta:'w32tm indisponível neste sistema'})+'\n');return}
  const r=spawnSync('w32tm',['/stripchart','/computer:time.windows.com','/samples:3','/dataonly'])
  const texto=(r.stdout??Buffer.alloc(0)).toString('latin1')
  writeFileSync(join(base,nome+'.json'),JSON.stringify({instante:Date.now(),servidor:'time.windows.com',offsetsMs:[...texto.matchAll(/([+-]\d+\.\d+)s/g)].map(m=>Number(m[1])*1000),codigo:r.status,saidaOriginalBase64:(r.stdout??Buffer.alloc(0)).toString('base64'),codificacao:'OEM Windows'},null,2)+'\n')
}
if (!existsSync(join(pasta,'resumo.json'))) {
  registrarRelogio('relogio-antes-'+periodo.id)
  for(let tentativa=1;tentativa<=2;tentativa++) {
    if(existsSync(pasta)) throw new Error('Pasta incompleta existente; preservar e revisar antes de repetir: '+pasta)
    const resultado=spawnSync(process.execPath,['--import',arg('--tsx','tsx'),join(raiz,'scripts/medir-wokwi.mjs'),
      '--env',resolve(arg('--env',join(raiz,'.env'))),'--wokwi',arg('--wokwi','wokwi-cli'),
      '--duracao-ms',String(plano.duracaoAquisicaoMs),'--sondas-configuracao','--apos-primeira-leitura','--saida',pasta],
      {cwd:raiz,stdio:'inherit',env:process.env})
    if(resultado.error) throw resultado.error
    if(resultado.status===0) break
    const erro=existsSync(join(pasta,'wokwi-stderr.log'))?readFileSync(join(pasta,'wokwi-stderr.log'),'utf8'):''
    if(tentativa===2||!/code 1006|closed before the connection was established/.test(erro)) process.exit(resultado.status??1)
    const destino=join(base,'tentativas-incompletas',periodo.id+'-'+Date.now())
    if(!resolve(pasta).startsWith(base+sep)||!resolve(destino).startsWith(base+sep))throw new Error('Caminho de diagnóstico inválido.')
    mkdirSync(resolve(destino,'..'),{recursive:true});renameSync(pasta,destino)
    if(Date.now()-Date.parse(periodo.previsto)>plano.atrasoMaximoInicioMs) throw new Error('Janela de horário ultrapassada após falha.')
  }
  registrarRelogio('relogio-apos-'+periodo.id)
}
const analise=spawnSync(process.execPath,[join(raiz,'scripts/analisar-comunicacao-wokwi.mjs'),base],{stdio:'inherit'})
process.exitCode=analise.status??1
