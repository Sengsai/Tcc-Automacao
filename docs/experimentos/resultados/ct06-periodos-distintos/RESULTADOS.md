# CT-06 — resultados finais e análise técnica

Coletas reais em 17/10/2026, horário de Brasília. Três aquisições de quatro minutos após a primeira leitura válida, separadas por aproximadamente três horas. São 12 minutos de aquisição total, com inicialização à parte, respeitando o limite de cinco minutos por sessão do plano disponível. Não são três sessões contínuas de dez minutos.

## Tempo de resposta com confirmação serial

Valores temporais em milissegundos. Caminho medido por relógio monotônico único: POST local → backend → MQTT público → ESP32 → serial/Wokwi/CLI → computador. Não equivale à latência unidirecional de telemetria nem ao RTT exclusivamente MQTT. Não dividir por dois nem comparar diretamente com a observação anterior de 2791 ms.

| Início (Brasília) | Mensagens | Sondas confirmadas | Mín. | Média | Mediana | DP populacional | p95 | Máx. | Perdas estimadas | Reconexões ESP32/backend |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 13:41:22.782 | 110 | 23 | 273.328 | 302.201 | 295.592 | 26.170 | 354.348 | 390.922 | 0 (0.000%) | 0/0 |
| 16:45:41.564 | 76 | 23 | 309.216 | 643.348 | 455.560 | 360.339 | 1400.445 | 1495.114 | 25 (24.752%) | 0/1 |
| 19:46:10.080 | 106 | 23 | 282.801 | 369.823 | 314.651 | 162.196 | 621.143 | 1046.958 | 0 (0.000%) | 0/0 |

Foram recebidas 292 mensagens de telemetria e confirmadas 69 de 69 sondas. A configuração permaneceu idêntica nas três aquisições; nenhuma confirmação sem sonda foi registrada. Perda estimada agregada: 25/(292+25) = 7,886435%; esse total não substitui a comparação por período.

A amplitude entre as médias dos períodos foi 341.147148 ms; entre medianas, 159.968900 ms.
A amplitude entre os p95 foi 1046.097200 ms. O período das 16h45 apresentou maior média e p95, 25 perdas estimadas e uma reconexão do backend após timeout de keepalive. A execução foi preservada, sem repetição para eliminar o resultado desfavorável. Três períodos não permitem inferir um padrão diário ou causalidade; são observações deste dia, ambiente e broker.

## Diferença de timestamps da telemetria — diagnóstico separado

| Início | Amostras | Mín. | Média | Mediana | DP populacional | p95 | Máx. | Negativas |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 13:41:22.782 | 110 | -89.000 | 8017.182 | 7936.000 | 4757.652 | 15466.000 | 16187.000 | 1 |
| 16:45:41.564 | 76 | -275.000 | 11867.882 | 8944.500 | 7977.039 | 23420.000 | 25183.000 | 1 |
| 19:46:10.080 | 106 | -493.000 | 10608.453 | 10184.000 | 6821.995 | 21601.000 | 22796.000 | 3 |

Essas diferenças usam relógios distintos e apresentam deriva e valores negativos. Não são uma estimativa validada do atraso físico unidirecional. As amostras negativas foram mantidas; não houve ajuste de tendência. O diagnóstico das seis séries anteriores continua em diagnostico-series-anteriores.json.

## Métodos, limites e arquivos

- Média e mediana sobre as respostas confirmadas; desvio-padrão populacional; p95 nearest-rank. Cálculo independente em Python conferido em validacao-independente.json. Valores completos, sem arredondamento editorial, em analise-comparativa.json e comparacao-execucoes.csv.
- Perda de telemetria estimada por lacunas de seq; não detecta perdas antes da primeira ou depois da última mensagem. Sonda sem confirmação é uma categoria separada de perda MQTT.
- Correlação serial por ordem, uma sonda em trânsito; pressupõe ausência de outro publicador no tópico. Payload {} conserva parâmetros, mas acrescenta tráfego ao cenário; não houve alteração de firmware, negócio, FSM ou roteiros existentes.
- Dados brutos por período: leituras.csv, eventos.jsonl, serial.log, sondas-configuracao.json/csv, resumo.json. Consultas do relógio antes/depois preservadas em relogio-*.json; a métrica complementar usa performance.now e não depende da sincronização entre relógios.
- Piloto e tentativa inicial incompleta estão separados e não integram as três execuções oficiais.
- typecheck, 158 casos TypeScript e 15 verificações C++ passaram antes da publicação. Logs em validacao/terceira-coleta.

Este arquivo contém dados e análise técnica para subsidiar a redação pelo Claude; não é texto de capítulo do TCC. O valor pontual anterior de 2791 ms não é validado nem substituído por uma métrica de caminho diferente.
