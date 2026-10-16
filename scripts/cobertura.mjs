// Mede todos os fontes TS/TSX, inclusive os que não são importados pelos testes.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destino = join(raiz, 'docs/experimentos/resultados/cobertura')
const resumo = { pacotes: {}, total: {} }
for (const pacote of ['backend', 'contrato', 'dashboard']) {
  const cwd = join(raiz, 'apps', pacote)
  const require = createRequire(join(cwd, 'package.json'))
  const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
  const pasta = join(destino, pacote)
  mkdirSync(pasta, { recursive: true })
  const resultado = spawnSync(process.execPath, [vitest, 'run', '--coverage',
    '--coverage.provider=v8', '--coverage.include=src/**/*.{ts,tsx}',
    '--coverage.exclude=src/**/*.test.ts', '--coverage.reporter=text',
    '--coverage.reporter=json-summary', '--coverage.reporter=json',
    '--coverage.reporter=html', `--coverage.reportsDirectory=${pasta}`,
    '--reporter=default', '--reporter=json', `--outputFile=${join(pasta, 'testes.json')}`,
  ], { cwd, stdio: 'inherit' })
  if (resultado.error) throw resultado.error
  if (resultado.status !== 0) process.exit(resultado.status ?? 1)
  const cobertura = JSON.parse(readFileSync(join(pasta, 'coverage-summary.json'), 'utf8'))
  resumo.pacotes[pacote] = cobertura.total
}
for (const metrica of ['lines', 'branches', 'functions', 'statements']) {
  const valores = Object.values(resumo.pacotes).map(p => p[metrica])
  const total = valores.reduce((n, v) => n + v.total, 0)
  const covered = valores.reduce((n, v) => n + v.covered, 0)
  resumo.total[metrica] = { total, covered, pct: total ? Math.floor(covered / total * 10000) / 100 : 100 }
}
writeFileSync(join(destino, 'resumo.json'), JSON.stringify(resumo, null, 2) + '\n')
