// Executa os mesmos testes C++ em Windows, Linux e macOS.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const pasta = mkdtempSync(join(tmpdir(), 'tcc-fsm-'))
const executavel = join(pasta, process.platform === 'win32' ? 'fsm_test.exe' : 'fsm_test')
try {
  const compilacao = spawnSync('g++', [
    '-std=c++17', '-Wall', '-Wextra', '-Ifirmware/include',
    'firmware/test/fsm_test.cpp', '-o', executavel,
  ], { stdio: 'inherit' })
  if (compilacao.error) throw compilacao.error
  if (compilacao.status !== 0) process.exitCode = compilacao.status ?? 1
  else {
    const teste = spawnSync(executavel, [], { stdio: 'inherit' })
    if (teste.error) throw teste.error
    process.exitCode = teste.status ?? 1
  }
} finally {
  rmSync(pasta, { recursive: true, force: true })
}
