# CT-06: coleta em períodos distintos — dados e análise técnica

Duas execuções oficiais realizadas; falta somente o período das 19:45. Consulte `analise-comparativa.json` para o estado atualizado; `concluida` somente será true quando os três períodos tiverem dados. O piloto não integra essa comparação.

## Agenda (Brasília)

- Período 1: 17/10/2026, início previsto 13:40; aquisição iniciada 13:41:22.782.
- Período 2: 17/10/2026, início previsto 16:45; aquisição iniciada 16:45:41.564.
- Período 3: 17/10/2026, 19:45.

Cada execução tem quatro minutos reais de aquisição após a primeira leitura com NTP, com até 45 segundos de inicialização. Essa duração mantém a sessão inteira dentro do limite de cinco minutos do plano gratuito. O horário real é registrado, sem renomear uma coleta atrasada como se tivesse ocorrido no horário previsto. Tolerância máxima de início: 15 minutos. O computador e o aplicativo precisam estar ativos e conectados.

## Investigação dos dados anteriores

As seis sessões consecutivas permanecem preservadas em `../wokwi-2026-10-17`. A regressão da diferença `recebidoEm-ts` contra o tempo real mostrou crescimento de aproximadamente 61 a 71 ms/s, com R² de 0,9981 a 0,99996. Há dez diferenças negativas. Isso demonstra uma tendência sistemática; não identifica por si só a causa nem permite separar atraso de rede de erro/deriva dos relógios. Não remover a tendência e chamar o resíduo de latência: isso apagaria uma eventual fila real e seria uma correção sem referência externa independente.

A documentação oficial informa que o relógio da simulação pode avançar mais lentamente que o relógio real: https://docs.wokwi.com/guides/esp32-wifi#viewing-wifi-traffic-with-wireshark . Essa é uma explicação compatível com os dados, não uma prova isolada da causa em cada pacote. Os resultados anteriores e o valor pontual de 2791 ms não foram substituídos, alterados ou misturados à nova métrica.

## Duas métricas separadas

1. **Diferença de timestamps da telemetria:** continua sendo registrada pelo backend original. É diagnóstico com relógios distintos, não uma estimativa validada da latência física unidirecional. Preservar amostras negativas e indicar sua contagem. `ts=0` é mantido nos dados brutos e excluído somente da estatística temporal.
2. **Tempo de resposta do comando com confirmação serial:** o coletor envia `{}` pelo endpoint de configuração já existente. O contrato aceita objeto vazio e o firmware conserva todos os parâmetros. O firmware original já imprime uma linha `[mqtt] config:` após processar cada mensagem. O coletor mede, no mesmo processo e com `performance.now()`, o intervalo desde o início do POST local até receber essa linha pelo CLI. Caminho: REST local → backend → MQTT público → ESP32 → serial → API Wokwi/CLI → computador. Inclui essas etapas; NÃO é RTT exclusivamente MQTT, NÃO é o tempo unidirecional da publicação de estado, NÃO dividir por dois e NÃO comparar diretamente com 2791 ms.

As sondas não mudam a lógica do firmware, a máquina de estados, os sensores ou os roteiros versionados. O tráfego adicional de configuração faz parte explícita do novo protocolo e pode afetar a comunicação; manter a mesma cadência em todos os períodos. Antes e depois, a configuração conhecida deve ser idêntica.

## Correlação e perdas

Enviar no máximo uma sonda a cada dez segundos e manter no máximo uma em trânsito. O protocolo original não devolve identificador na confirmação; a correlação é por ordem, sob a condição experimental de não haver outro publicador no tópico de configuração. Preservar confirmações sem sonda. Após qualquer falha/timeout de 15 s, interromper novas sondas naquela execução, para não atribuir uma resposta atrasada à próxima. Se houver indício de configuração externa, não considerar a correlação validada.

Perda de telemetria é estimada por lacunas em `seq`, com a fórmula original `perdidas/(recebidas+perdidas)`. Não detecta perdas antes da primeira ou depois da última mensagem. Sondas sem confirmação são contadas separadamente: não equivalem automaticamente a pacotes MQTT perdidos. Reconexões espontâneas excluem a primeira conexão e as partidas planejadas entre períodos.

## Estatísticas e comparação

Por período: quantidade de mensagens, perda e reconexões; mínimo, média, mediana, desvio-padrão populacional, p95 por nearest-rank e máximo para as respostas confirmadas. Estatísticas de timestamps continuam em campo diagnóstico separado. O comparativo calcula amplitude das médias, medianas e p95 entre execuções realizadas. Resultados parciais são rotulados; não declarar comparação completa com período ausente.

## Piloto

`piloto-60s` contém uma validação curta com cinco confirmações, configuração preservada e nenhuma falha de sonda. Estatísticas verificadas independentemente em Python em `validacao-piloto.json`. A primeira tentativa falhou na conexão WebSocket antes de receber dados; o erro está em `tentativas-incompletas/piloto-01`. Nenhuma dessas tentativas é execução oficial da agenda.

## Reprodução

Usar Node 24, pnpm 11, firmware já compilado, token por arquivo local ignorado e wokwi-cli. No horário autorizado, o executor escolhe somente a janela correspondente, impede sobrescrita, permite uma repetição para erro de transporte e gera a análise. Não executar várias instâncias do firmware (client ID fixo).

```powershell
node scripts/executar-periodo-wokwi.mjs --env "C:\caminho\env" --wokwi "C:\caminho\wokwi-cli.exe" --tsx tsx
node scripts/analisar-comunicacao-wokwi.mjs docs/experimentos/resultados/ct06-periodos-distintos
```

O executor não espera horas: é chamado pelo agendamento. Se o período foi perdido, registrar a ausência e combinar outro horário, sem fabricar dados. Após cada coleta, executar typecheck, test e test:fsm; fazer commit e publicar somente com verificações verdes. Nenhum arquivo do TCC é produzido por este protocolo; a interpretação e redação acadêmica ficam a cargo do Claude e dos autores.

## Resultado parcial do segundo período

Aquisição de 240007 ms: 76 mensagens recebidas e 25 perdas estimadas por lacunas de sequência (24,752475%). Houve um timeout de keepalive MQTT e uma reconexão do backend, sem reconexão do ESP32 identificada no serial. As 23 sondas foram confirmadas; média 643,348222 ms, mediana 455,560500 ms e p95 1400,445100 ms. Configuração preservada, nenhuma confirmação sem sonda. O evento de conexão permanece nos dados brutos; a execução não foi descartada nem repetida por apresentar perda. A comparação permanece parcial até a terceira aquisição.
