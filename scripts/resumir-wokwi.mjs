import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2];
if(!base) throw new Error('Informe a pasta com as seis sessões.');
const local=ms=>new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
const sessoes=[];
function metricas(rows){
 const lat=rows.filter(r=>r[4]!=='').map(r=>Number(r[4])).sort((a,b)=>a-b);
 const n=lat.length;assert(n>0);
 const media=lat.reduce((a,b)=>a+b,0)/n;
 const perdidas=rows.reduce((n,r)=>n+Number(r[5]),0);
 return {mensagens:rows.length,amostrasLatencia:n,semNtp:rows.length-n,minMs:lat[0],mediaMs:media,medianaMs:n%2?lat[Math.floor(n/2)]:(lat[n/2-1]+lat[n/2])/2,desvioPadraoPopulacionalMs:Math.sqrt(lat.reduce((s,v)=>s+(v-media)**2,0)/n),p95Ms:lat[Math.ceil(.95*n)-1],maxMs:lat.at(-1),latenciasNegativas:lat.filter(v=>v<0).length,perdidas,taxaPerda:perdidas/(rows.length+perdidas)};
}
let header;
for(let i=1;i<=6;i++){
 const pasta=`${base}/sessao-${i}`;
 const resumo=JSON.parse(fs.readFileSync(pasta+'/resumo.json'));
 assert.equal(resumo.duracaoSolicitadaMs,300000);assert(resumo.fim-resumo.inicio>=300000);
 const lines=fs.readFileSync(pasta+'/leituras.csv','utf8').trim().split('\n');
 header=lines.shift();const rows=lines.map(l=>l.split(','));
 for(const r of rows){assert(Number(r[0])>=resumo.inicio&&Number(r[0])<=resumo.fim);if(r[4]!=='')assert.equal(Number(r[4]),Number(r[0])-Number(r[3]));}
 const m=metricas(rows);assert.equal(m.mensagens,resumo.metricas.perda.recebidas);assert.equal(m.amostrasLatencia,resumo.metricas.latencia.amostras);assert.equal(m.minMs,resumo.metricas.latencia.minMs);assert.equal(m.p95Ms,resumo.metricas.latencia.p95Ms);assert(Math.abs(m.mediaMs-resumo.metricas.latencia.mediaMs)<1e-8);
 sessoes.push({sessao:i,grupo:Math.ceil(i/2),inicio:resumo.inicio,fim:resumo.fim,inicioBrasilia:local(resumo.inicio),fimBrasilia:local(resumo.fim),duracaoMs:resumo.fim-resumo.inicio,primeiraMensagemEm:Number(rows[0][0]),ultimaMensagemEm:Number(rows.at(-1)[0]),reconexoesEsp32:resumo.reconexoesEsp32,reconexoesBackend:resumo.reconexoesBackend,...m,rows});
}
const grupos=[];
for(let g=1;g<=3;g++){
 const a=sessoes[(g-1)*2],b=sessoes[(g-1)*2+1];const rows=[...a.rows,...b.rows];
 const group={grupo:g,sessoes:[a.sessao,b.sessao],inicioBrasilia:a.inicioBrasilia,fimBrasilia:b.fimBrasilia,duracaoSomadaJanelasMs:a.duracaoMs+b.duracaoMs,intervaloEntreSessoesMs:b.inicio-a.fim,spanTotalMs:b.fim-a.inicio,reiniciosPlanejados:1,reconexoesEsp32:a.reconexoesEsp32+b.reconexoesEsp32,reconexoesBackend:a.reconexoesBackend+b.reconexoesBackend,...metricas(rows)};grupos.push(group);
 fs.writeFileSync(`${base}/grupo-${g}-leituras.csv`,'sessao,grupo,'+header+'\n'+[a,b].flatMap(s=>s.rows.map(r=>`${s.sessao},${g},${r.join(',')}`)).join('\n')+'\n');
}
const compact=sessoes.map(({rows,...s})=>s);
fs.writeFileSync(base+'/resumo-sessoes.json',JSON.stringify(compact,null,2)+'\n');
fs.writeFileSync(base+'/resumo-grupos.json',JSON.stringify(grupos,null,2)+'\n');
function salvarCsv(name,objects){const keys=Object.keys(objects[0]);const campo=v=>{const s=Array.isArray(v)?v.join('+'):String(v);return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s};fs.writeFileSync(`${base}/${name}.csv`,keys.join(',')+'\n'+objects.map(o=>keys.map(k=>campo(o[k])).join(',')).join('\n')+'\n')}
salvarCsv('resumo-sessoes',compact);salvarCsv('resumo-grupos',grupos);
console.log(JSON.stringify({sessoes:compact,grupos},null,2));
