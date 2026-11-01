# Quadros de apoio — TCC Sistema automatizado de controle de iluminação e temperatura baseado em presença

Quadros retirados do PDF por limite de extensão. O texto os referencia como "repositório do projeto (docs/quadros-apoio.md)"; cada título indica a seção do trabalho que o cita.

## Tecnologias de detecção de ocupação e critérios de escolha (seção 1.2)

| Tecnologia | Princípio e característica | Custo | Detecta parado | Privacidade | Complexidade |
|---|---|---|---|---|---|
| PIR | Variação de radiação infravermelha causada por movimento | Muito baixo | Não | Alta | Baixa |
| PIR + sensor de porta | Combina movimento com eventos de entrada e saída para inferir permanência | Muito baixo | Indireta | Alta | Baixa |
| PIR + ultrassônico | Efeito Doppler detecta pequenos movimentos; sensível a obstáculos e a vibração | Baixo | Parcial | Alta | Média |
| PIR + micro-ondas | Doppler de alta sensibilidade; o PIR aciona o micro-ondas para poupar energia | Baixo | Parcial | Alta | Média |
| PIR + CO₂ | Concentração indica ocupação, com atraso de minutos na resposta | Médio | Sim | Alta | Média |
| Radar de ondas milimétricas | Detecta micromovimentos, inclusive respiração, sem captar imagem | Médio | Sim | Alta | Alta |
| Sensor térmico de baixa resolução | Matriz de poucos pixels; detecta presença sem identificar pessoas | Médio | Sim | Média | Alta |
| Visão computacional | Câmera com processamento de imagem; permite contagem e identificação | Alto | Sim | Baixa | Alta |

Fonte: elaborado pelos autores (2026), com base em Labeodan et al. (2015), Guo et al. (2010) e Cheng et al. (2020).

## Correspondência entre o modelo do TC I e o protótipo (seção 3.3)

| Componente no TC I | Implementação | Observação |
|---|---|---|
| ESP32 DevKit v1 com FreeRTOS | ESP32 DevKit C v4 no Wokwi, FreeRTOS, 4 tarefas | Mesmo código de uma placa real |
| Sensores PIR, DHT22, LDR | Componentes simulados do Wokwi | Sem ruído real de sensor |
| Relé SSR (iluminação) | LED amarelo no GPIO26 | Representa o relé |
| LED IR (ar-condicionado) | LED azul no GPIO25 | Wokwi não simula infravermelho |
| Broker Mosquitto | Aedes embutido; HiveMQ público para o firmware | Mosquitto segue compatível no modo externo |
| Node.js + Express, API REST | Node.js + Express 5 | Mantido |
| InfluxDB (séries temporais) | SQLite (módulo node:sqlite) | Banco embutido; exportação CSV |
| React + TypeScript, Recharts, WebSocket | React 19 + TypeScript, Recharts, WebSocket | Mantido |
| Serviços em Docker | Aplicativo Electron | Instalável em macOS e Windows |

Fonte: elaborado pelos autores (2026).

## Tecnologias utilizadas e justificativas (seção 3.4)

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Embarcada | C++ (framework Arduino), FreeRTOS, PlatformIO | Padrão do ecossistema ESP32; tarefas concorrentes com prioridades e mutex (BARRY, 2016) |
| Embarcada | PubSubClient, ArduinoJson, DHTesp | Bibliotecas maduras para MQTT, JSON e DHT22 no ESP32 |
| Simulação | Wokwi (wokwi-cli e extensão VS Code) | Executa o firmware compilado sem hardware, com sensores interativos |
| Comunicação | MQTT (Aedes; HiveMQ) | Publicação/assinatura leve, adequada a telemetria (HUNKELER; TRUONG; STANFORD-CLARK, 2008) |
| Backend | Node.js 24, Express 5, ws, zod | Previsto no TC I; validação das mensagens na fronteira do sistema |
| Persistência | SQLite (node:sqlite, modo WAL) | Embutido no próprio Node, sem servidor separado |
| Interface | React 19, TypeScript, Recharts, Vite | Previsto no TC I; tipagem estática e gráficos declarativos |
| Empacotamento | Electron 44, electron-builder | Instaladores .dmg e .exe a partir do mesmo código web |
| Qualidade | Vitest, g++, GitHub Actions | Testes automatizados a cada envio ao repositório |
| Organização | pnpm workspaces (monorrepositório) | Pacotes separados por responsabilidade, com contrato de dados compartilhado |

Fonte: elaborado pelos autores (2026).

## Ligação dos componentes ao ESP32 (seção 3.5)

| Componente | Pino | Função |
|---|---|---|
| Sensor PIR | GPIO27 | Entrada digital de presença |
| DHT22 | GPIO15 | Temperatura e umidade (protocolo de um fio) |
| LDR (módulo fotorresistor) | GPIO34 (ADC1) | Entrada analógica de luminosidade |
| LED amarelo (luz) | GPIO26 | Representa o relé de iluminação |
| LED azul (HVAC) | GPIO25 | Representa o comando infravermelho do ar-condicionado |

Fonte: elaborado pelos autores (2026).

## Principais rotas da API REST (seção 3.7)

| Método | Rota | Função |
|---|---|---|
| GET | /api/saude | Estado do servidor e da conexão com o broker |
| GET | /api/dispositivos | Dispositivos já vistos |
| GET | /api/dispositivos/:id/estado | Último estado do dispositivo |
| GET | /api/dispositivos/:id/leituras | Leituras de um período |
| GET | /api/dispositivos/:id/metricas | Métricas de um período |
| GET | /api/dispositivos/:id/export.csv | Exportação das leituras em CSV |
| POST | /api/dispositivos/:id/config | Publica nova configuração no dispositivo |
| GET/PUT | /api/configuracoes | Consulta e altera broker e modo Demo |
| POST | /api/demo, /api/demo/pir, /api/demo/ambiente | Controla o dispositivo simulado |

Fonte: elaborado pelos autores (2026).

## Composição da suíte de testes automatizados (seção 3.10)

| Natureza | Módulo | Casos | Escopo verificado |
|---|---|---|---|
| Unitário | Máquina de estados (TypeScript) | 15 | Espelho exato dos casos em C++ (Quadro 10) |
| Unitário | Máquina de estados (C++) | 15 | Mesmos casos, compilados com o firmware |
| Contrato | Pacote de contrato (zod) | 29 | Formatos de mensagem, consultas e respostas da API |
| Unitário | Processamento e métricas | 21 | Latência, perda, percentil, tempo ligado e ocupação |
| Unitário | Armazenamento e configurações | 13 | Gravação, consulta por período e persistência de ajustes |
| Unitário | Exportação CSV | 4 | Cabeçalho, escape de campos e valores nulos |
| Integração | Broker e cliente MQTT | 9 | Caminho completo da mensagem até a gravação |
| Integração | API REST e modo Demo | 17 | Rotas, validação de entrada e comandos do dispositivo simulado |
| Integração | Executor de roteiros | 6 | Relógio virtual, ocupação de referência e métricas do roteiro |
| Regressão | Roteiros versionados | 6 | Cada roteiro reproduz o valor publicado neste texto |
| Unitário | Dispositivo simulado | 7 | Publicação periódica, pulso do PIR e aplicação de configuração |
| Unitário | Funções do painel | 30 | Formatação, séries dos gráficos e reconexão do WebSocket |
| Encerramento | Processo do backend | 1 | Encerra sem deixar recursos abertos |

Fonte: elaborado pelos autores (2026), a partir da execução da suíte em 16 de outubro de 2026.

## Proposta de requisitos de segurança para uso real (seção 3.11)

| Ameaça | Mecanismo proposto | Observação de implantação |
|---|---|---|
| Leitura das mensagens por terceiros | TLS entre dispositivo e broker, com verificação do certificado do servidor no firmware | O ESP32 suporta TLS; custa memória e aumenta o tempo de conexão |
| Dispositivo não autorizado publicando leituras | Autenticação por dispositivo, com credencial ou certificado de cliente próprio, sem senha compartilhada | Exige provisionamento por unidade e rotação de credenciais |
| Comando forjado alterando a configuração | Autorização por tópico: cada dispositivo só publica em sua raiz e só assina sua configuração | Regra de ACL no broker; o Aedes embutido exigiria extensão |
| Repetição de comando capturado | Número de sequência ou carimbo de tempo na configuração, com rejeição de mensagens antigas ou repetidas | Depende de relógio sincronizado no dispositivo |
| Configuração inválida ou fora de faixa | Validação de esquema e de faixa no firmware, antes de aplicar, como já ocorre no backend | Parcialmente atendido: o firmware ignora campos de tipo inválido |
| Firmware adulterado | Atualização remota assinada, com verificação de assinatura antes de gravar | Não previsto no protótipo; exige infraestrutura de chaves |
| Credenciais extraídas do dispositivo | Armazenamento em área protegida do microcontrolador, e não em constantes do código | Hoje as credenciais de rede são constantes de compilação |
| Alcance lateral a partir do dispositivo | Segmentação de rede, isolando os dispositivos de automação do restante da rede local | Medida de instalação, não de software |

Fonte: elaborado pelos autores (2026).

## Origem e alcance dos resultados apresentados (seção 4.7)

| Resultado | Origem | O que sustenta | O que não sustenta |
|---|---|---|---|
| Lógica de ocupação (CT-01) | Teste automatizado | Concordância entre firmware e dispositivo simulado nos casos previstos | Equivalência semântica geral; comportamento diante de sinais reais de sensor |
| Cenários funcionais (CT-02 a CT-05, CT-08) | Dispositivo simulado interno | Que as regras e a configuração remota funcionam como especificado | Desempenho com hardware ou sob falha de rede |
| Latência local (CT-06) | Medição em tempo real, mesma máquina | Ordem de grandeza do caminho local, do dispositivo simulado à entrada do backend | Latência em rede real, com relógios distintos |
| Tempo de resposta com o firmware | Três aquisições de 4 min pela internet | Ordem de grandeza do caminho completo e sua variabilidade entre horários | Latência unidirecional, padrão diário ou causalidade |
| Diferença de carimbos de tempo (incluindo os 2.791 ms) | Diagnóstico com relógios distintos | Que a grandeza tem deriva sistemática e não mede atraso de rede | Qualquer estimativa de latência |
| Falsos positivos e negativos (CT-07) | Simulação com modelo idealizado de PIR | Que a confirmação por contagem de bordas falha com movimento contínuo | Taxas de erro com sensores reais |
| Redução do tempo de acionamento (CT-09) | Estimativa sintética | Comparação entre configurações e estratégias sob a mesma ocupação | Economia de energia em instalação real |
| Achados da revisão | Literatura (nove estudos) | Tendências entre os trabalhos reunidos por este protocolo | O que predomina na literatura da área |

Fonte: elaborado pelos autores (2026).

