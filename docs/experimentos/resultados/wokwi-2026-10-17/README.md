# CT-06 — seis sessões de cinco minutos, agrupadas em três pares

Coleta realizada em 17/10/2026, horário de Brasília. Protocolo ajustado por autorização expressa de Gabriel: seis sessões sequenciais de 300000 ms, agrupadas como (1+2), (3+4), (5+6). São dez minutos SOMADOS de janelas por par; não são execuções contínuas de dez minutos. Cada janela inclui inicialização, Wi-Fi, MQTT e sincronização NTP do ESP32. O backend já estava conectado antes da janela.

## Resultados dos três pares

Diferenças temporais em milissegundos, calculadas como recebidoEm − ts, sem correção ou exclusão silenciosa de valores negativos.

| Par | Sessões | Mensagens | Amostras com NTP | Mín. | Média | Mediana | DP populacional | p95 | Máx. | Perdidas | Perda % | Reconexões ESP32/backend | Negativas |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1+2 | 272 | 268 | -174 | 9495,91 | 9464,50 | 5531,10 | 18113 | 19974 | 0 | 0,00 | 0/0 | 3 |
| 2 | 3+4 | 271 | 268 | -158 | 9245,69 | 9214,50 | 5567,78 | 18283 | 20215 | 0 | 0,00 | 0/0 | 4 |
| 3 | 5+6 | 273 | 270 | -150 | 9178,32 | 9092,50 | 5530,84 | 17932 | 18930 | 0 | 0,00 | 0/0 | 3 |

## Sessões individuais e horários reais

| Sessão | Início Brasília | Fim Brasília | Janela real (s) | Mensagens | Amostras com NTP |
|---|---|---|---:|---:|---:|
| 1 | 17/10/2026, 12:26:12 | 17/10/2026, 12:31:12 | 300.011 | 136 | 134 |
| 2 | 17/10/2026, 12:32:08 | 17/10/2026, 12:37:08 | 300.009 | 136 | 134 |
| 3 | 17/10/2026, 12:37:19 | 17/10/2026, 12:42:19 | 300.006 | 135 | 133 |
| 4 | 17/10/2026, 12:42:29 | 17/10/2026, 12:47:29 | 300.002 | 136 | 135 |
| 5 | 17/10/2026, 12:47:40 | 17/10/2026, 12:52:40 | 300.012 | 137 | 135 |
| 6 | 17/10/2026, 12:52:50 | 17/10/2026, 12:57:50 | 300.013 | 136 | 135 |

| Par | Soma das janelas (s) | Intervalo entre sessões (s) | Tempo decorrido do início ao fim do par (s) |
|---|---:|---:|---:|
| 1 | 600.020 | 56.164 | 656.184 |
| 2 | 600.008 | 10.536 | 610.544 |
| 3 | 600.025 | 10.573 | 610.598 |

Total: 816 mensagens; 10 com ts=0 (sem NTP), excluídas apenas das estatísticas temporais, mas mantidas na contagem de mensagens e nos CSVs; 10 diferenças negativas mantidas e sinalizadas.

## Método e interpretação

- Firmware original, sem alterações de lógica, máquina de estados, pinos, sensores ou roteiros. Diagrama original, sem automação de estímulos; PIR permaneceu em baixo nas sessões.
- Broker público broker.hivemq.com:1883, tópico tcc-unip-7f3a9c/sala01/estado. Backend em modo externo e Demo desligado. Mesmo binário em todas as sessões; hash e versões em proveniencia.json.
- Janela medida com relógio monotônico do computador; timestamps UTC em epoch ms, apresentados também em America/Sao_Paulo. As pequenas diferenças acima de 300 s são de agendamento do temporizador. A exportação e as consultas de horário entre sessões não entram na soma das janelas.
- Mediana, média e desvio-padrão calculados diretamente de todas as amostras do par; não foi feita média das estatísticas das sessões. Desvio-padrão populacional: raiz da soma dos desvios quadráticos dividida por N.
- p95 por nearest-rank: valor no posto ceil(0,95 × N) da série ordenada, igual ao método do backend.
- Perda estimada por lacunas em seq, conforme processamento.ts, e taxa = perdidas/(recebidas+perdidas). O contador é reiniciado a cada sessão; lacunas não são calculadas cruzando sessões. O método não detecta mensagens perdidas antes da primeira recebida nem depois da última. Quantidade menor que a cadência nominal não prova perda: há inicialização e tempo virtual de simulação.
- Reconexões espontâneas do ESP32 contadas por mensagens seriais de conexão posteriores à primeira; reconexões do backend por eventos WebSocket durante a janela. As seis partidas do firmware e os cinco reinícios planejados entre sessões não são reconexões espontâneas. Cada par contém um reinício planejado.

## Limitações materiais para o TCC

A diferença recebidoEm − ts é uma estimativa APARENTE no ambiente simulado, não uma medição isolada da latência física da rede. O PC e o ESP32 usam relógios distintos. Há pequenas diferenças negativas, fisicamente incompatíveis com latência de transporte, e crescimento da diferença ao longo das sessões. Isso é compatível com efeitos de sincronização, deriva do relógio virtual, filas e execução da nuvem, mas este experimento não separa essas causas. Os números brutos não foram corrigidos nem truncados em zero. Não apresentar estes percentuais/tempos como benchmark de rede local ou de ESP32 físico.

O relógio do computador foi comparado com time.windows.com antes e depois das sessões; os resultados estão nos arquivos relogio-*.log. Mesmo consultas NTP têm incerteza de rede e não demonstram sincronização perfeita do ESP32 virtual. Leituras com ts=0 permanecem no CSV, sem latência definida.

O plano gratuito encerra sessões em cinco minutos. Por isso a janela começa no lançamento do CLI e inclui inicialização. O tempo de recepção efetiva de mensagens em cada sessão é menor que cinco minutos; primeiraMensagemEm e ultimaMensagemEm estão nos resumos JSON/CSV. Não afirmar que houve cinco minutos completos de publicações após o aquecimento.

## Falhas e tentativas

Houve uma tentativa vazia da sessão 2 encerrada por erro de transporte do Wokwi (code 1006), antes de receber mensagens. Foi preservada em tentativas-incompletas/sessao-2-tentativa-1 e repetida. Ela não integra os seis resultados, nem foi escondida. O intervalo maior do primeiro par inclui essa falha e sua repetição. Tentativas anteriores de 16/10, feitas com outro protocolo ou antes da sincronização, não foram misturadas a estes resultados.

## Arquivos e reprodução

Cada sessao-N contém leituras.csv, resumo.json, eventos.jsonl, serial.log e, quando houver, wokwi-stderr.log. Os CSVs grupo-N-leituras.csv identificam a sessão de origem de cada linha. resumo-sessoes e resumo-grupos estão em JSON e CSV. Bancos SQLite de trabalho ficaram locais; os CSVs e eventos brutos foram publicados. Nenhum token foi incluído.

Com Node 24, pnpm 11, firmware compilado e wokwi-cli no PATH:

```powershell
pnpm exp:wokwi --env "C:\caminho\env" --duracao-ms 300000 --saida "C:\caminho\resultados\NOVA-PASTA\sessao-1"
```

Como a execução via pnpm ocorre em apps/backend, usar um caminho ABSOLUTO para --env e --saida para evitar ambiguidade. Repetir sequencialmente até sessao-6, usando backend separado e reiniciando o firmware. Depois, a partir da raiz:

```powershell
node scripts/resumir-wokwi.mjs docs/experimentos/resultados/NOVA-PASTA
```

O resumidor confere os seis intervalos, a igualdade recebidoEm − ts, contagens e estatísticas do backend, antes de salvar os pares. Ao compilar no Windows, caminhos longos podem exceder o limite do comando; nesta máquina foi usado um atalho temporário T: para work, sem alterar firmware/platformio.ini.

As verificações obrigatórias antes do commit estão em validacao/: pnpm typecheck, pnpm test e pnpm test:fsm. Não foram alteradas as asserções dos testes.

Os logs de consulta de horário emitidos pelo utilitário Windows foram convertidos de OEM CP850 para UTF-8 para publicação; os valores e horários foram preservados.
