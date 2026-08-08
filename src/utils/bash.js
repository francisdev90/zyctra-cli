import { spawn } from 'child_process'
import chalk from 'chalk'

export function extractBashBlocks(text) {
  const blocks = []
  const re = /```(?:bash|sh|shell|zsh|cmd|powershell|ps1|ps)\n([\s\S]*?)```/gi
  let m
  while ((m = re.exec(text)) !== null) {
    const cmd = m[1].trim()
    if (cmd) blocks.push(cmd)
  }
  return blocks
}

export function runCommand(cmd) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32'
    const shell     = isWindows ? 'powershell.exe' : '/bin/bash'
    const args      = isWindows ? ['-Command', cmd] : ['-c', cmd]

    const child = spawn(shell, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: process.cwd(),
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      const text = data.toString()
      process.stdout.write(text)
      stdout += text
    })

    child.stderr.on('data', (data) => {
      const text = data.toString()
      process.stdout.write(chalk.yellow(text))
      stderr += text
    })

    child.on('close', (code) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 0 })
    })

    child.on('error', (err) => {
      const msg = `Cannot run: ${err.message}`
      process.stdout.write(chalk.red(`\n  ✗ ${msg}\n`))
      resolve({ stdout: '', stderr: msg, code: 1 })
    })
  })
}
