# Cobertura e contagem de testes — 16/10/2026

Base: `e314cfd94e9174cc728e338a9498f602e9e57697` (9 commits originais preservados).

Ambiente: Windows x64, Node 24.19.0, pnpm 11.11.0, Vitest e provider V8 5.0.1, GCC 16.2.0.

Escopo: `src/**/*.{ts,tsx}` de backend, contrato e dashboard, excluindo `src/**/*.test.ts`. Inclui módulos não importados pelos testes. Não inclui Electron, firmware, dependências, testes ou arquivos de configuração. Percentuais totais calculados pela soma de unidades cobertas dividida pela soma de unidades instrumentadas, não pela média dos percentuais. Percentuais truncados em duas casas, como nos relatórios do Istanbul.

| Pacote | Linhas cobertas/total | Linhas % | Ramos cobertos/total | Ramos % | Testes TS |
|---|---:|---:|---:|---:|---:|
| backend | 495/606 | 81.68 | 283/368 | 76.90 | 99 |
| contrato | 29/31 | 93.54 | 0/4 | 0.00 | 29 |
| dashboard | 37/477 | 7.75 | 19/478 | 3.97 | 30 |
| TOTAL | 561/1114 | 50.35 | 302/850 | 35.52 | 158 |

## Módulos com zero linhas cobertas

### apps/backend

- `apps/backend/src/cli.ts`
- `apps/backend/src/experimentos/cli.ts`
- `apps/backend/src/experimentos/latencia.ts`

### apps/contrato

Nenhum módulo com linhas instrumentadas totalmente sem cobertura.

### apps/dashboard

- `apps/dashboard/src/App.tsx`
- `apps/dashboard/src/api.ts`
- `apps/dashboard/src/contexto.tsx`
- `apps/dashboard/src/main.tsx`
- `apps/dashboard/src/useAgora.ts`
- `apps/dashboard/src/useWs.ts`
- `apps/dashboard/src/componentes/ControlesDemo.tsx`
- `apps/dashboard/src/componentes/DiagramaEsp32.tsx`
- `apps/dashboard/src/componentes/DiagramaFsm.tsx`
- `apps/dashboard/src/componentes/Graficos.tsx`
- `apps/dashboard/src/componentes/IndicadorConexao.tsx`
- `apps/dashboard/src/componentes/LogMqtt.tsx`
- `apps/dashboard/src/componentes/PainelAjuste.tsx`
- `apps/dashboard/src/componentes/SeletorDispositivo.tsx`
- `apps/dashboard/src/telas/Configuracoes.tsx`
- `apps/dashboard/src/telas/Controladora.tsx`
- `apps/dashboard/src/telas/Historico.tsx`

O contrato tem cobertura de linhas alta, mas zero dos quatro ramos instrumentados foi executado. O dashboard testa utilitários; componentes, telas e integração da interface não estão cobertos. Arquivos sem unidades executáveis não devem ser confundidos com módulos testados.

## Contagens e verificações

- TypeScript: 158 casos executados e aprovados em 16 arquivos (backend 99/12 arquivos; contrato 29/1; dashboard 30/3).
- C++: 15 chamadas CHECK executadas e aprovadas, em um executável; zero falhas. São verificações, não 15 executáveis ou arquivos de teste.
- Electron: não tem testes próprios; seu script apenas informa isso e não foi contabilizado como teste.
- Comandos exigidos: `pnpm typecheck`, `pnpm test`, `pnpm test:fsm`. Logs anexos.

## Reprodução e particularidades do ambiente

Instale as dependências com Node 24 e pnpm 11, disponibilize g++ no PATH e execute `pnpm test:coverage`. O comando grava JSON, HTML e resumo nesta pasta. `pnpm test:fsm` agora usa um diretório temporário portátil; nenhum teste ou código da máquina de estados foi alterado.

Neste ambiente isolado do Windows, foi necessário instalar com `--node-linker=hoisted --config.inject-workspace-packages=true --config.dedupe-injected-deps=false --store-dir node_modules/.cache/pnpm-store` por restrição a links simbólicos. O lockfile publicado mantém a configuração original do projeto e acrescenta o provider. A verificação automática de reinstalação do pnpm foi desativada apenas na execução local (`--config.verify-deps-before-run=false`). TEMP e TMP apontaram para uma pasta de trabalho compartilhada entre processos, corrigindo ENOENT do cache do Vitest.

Falhas iniciais (logs do Vitest e C++ anexos): EPERM na instalação por links; ENOENT de arquivos temporários ao carregar oito suítes do backend; caminho Unix /tmp inexistente no comando C++. As duas primeiras foram resolvidas por configuração do ambiente; a última por infraestrutura portátil de execução. Nenhuma asserção foi modificada. O GCC ainda emite três avisos de inicialização de confirmacaoPorNivelMs; os testes passam.

## Wokwi

Tarefa pulada: não existe .env na cópia clonada e, portanto, não há WOKWI_CLI_TOKEN configurado nesse arquivo. Não foram coletadas execuções nem reutilizados resultados antigos como novas medições.
