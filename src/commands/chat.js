import readline from 'readline'
import chalk from 'chalk'
import boxen from 'boxen'
import { config } from '../config.js'
import { askZyctra, getUsageStats } from '../ai.js'

function showWelcome(engine, email, plan) {
  const engineLabel = engine.charAt(0).toUpperCase() + engine.slice(1)
  const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1)
  const cols        = process.stdout.columns || 80

  const content =
    `${chalk.cyan('✸')}  ${chalk.bold.white('Zyctra')}  ${chalk.cyan('✸')}` +
    ' '.repeat(Math.max(0, cols - 40)) +
    `${chalk.gray('zyctra.com')}\n` +
    `${chalk.gray('AI that remembers you')}\n\n` +
    `${chalk.gray('Engine')} · ${chalk.cyan(engineLabel)} · ${chalk.gray(email)} · ${chalk.cyan(planLabel)}\n\n` +
    `${chalk.gray('─'.repeat(cols - 6))}\n\n` +
    `${chalk.white('zyctra "question"')}     ${chalk.gray('Ask anything')}\n` +
    `${chalk.white('zyctra fix file.js')}    ${chalk.gray('Fix bugs in a file')}\n` +
    `${chalk.white('zyctra explain file')}   ${chalk.gray('Explain a file')}\n` +
    `${chalk.white('zyctra commit')}         ${chalk.gray('Generate commit message')}\n` +
    `${chalk.white('zyctra logout')}         ${chalk.gray('Logout')}\n\n` +
    `${chalk.gray('─'.repeat(cols - 6))}\n` +
    `${chalk.gray('Type your message below. Ctrl+C to exit.')}`

  console.log(boxen(content, {
    padding: 1,
    margin: 0,
    borderStyle: 'round',
    borderColor: 'cyan',
    title: chalk.cyan('✸ Zyctra CLI v1.0.0'),
    titleAlignment: 'center',
    width: cols,
  }))
}

export async function chat(prompt) {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.red('\n✗ Please login first: zyctra login\n'))
    return
  }

  const email     = config.get('email')
  const engine    = config.get('engine')    || 'zev'
  const plan      = config.get('plan')      || 'free'
  const isFounder = config.get('isFounder') || false

  showWelcome(engine, email, plan)

  const messages = []

  // One-shot mode: prompt passed as CLI argument
  if (prompt) {
    messages.push({ role: 'user', content: prompt })
    console.log(chalk.white(`You: ${prompt}`))
    await askZyctra(messages)
    return
  }

  // Interactive mode
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  })

  rl.on('SIGINT', () => {
    console.log(chalk.cyan('\n\n✦ Goodbye!\n'))
    rl.close()
    process.exit(0)
  })

  const divider = () => console.log(chalk.gray('─'.repeat(process.stdout.columns || 80)))

  const showPrompt = () => {
    divider()
    rl.setPrompt(chalk.cyan('❯ '))
    rl.prompt()
  }

  rl.on('line', async (input) => {
    const trimmed = input.trim()

    if (!trimmed) {
      rl.setPrompt(chalk.cyan('❯ '))
      rl.prompt()
      return
    }

    if (['exit', 'quit', 'q'].includes(trimmed.toLowerCase())) {
      console.log(chalk.cyan('\n✦ Goodbye!\n'))
      rl.close()
      return
    }

    divider()

    const termWidth = process.stdout.columns || 80

    if (!isFounder) {
      const { percentage, resetTime } = await getUsageStats(token)

      if (percentage !== undefined) {
        if (percentage >= 100) {
          const limitText = `✗ Usage limit reached · Resets at ${resetTime} · Upgrade at zyctra.com/plans`
          const spaces = ' '.repeat(Math.max(0, termWidth - limitText.length))
          console.log(spaces + chalk.red(limitText))
          rl.setPrompt(chalk.cyan('❯ '))
          rl.prompt()
          return
        } else if (percentage >= 80) {
          const warningText = `⚠ ${percentage}% used · Resets at ${resetTime}`
          const spaces = ' '.repeat(Math.max(0, termWidth - warningText.length))
          console.log(spaces + chalk.yellow(warningText))
        } else {
          const infoText = `${percentage}% used · Resets at ${resetTime}`
          const spaces = ' '.repeat(Math.max(0, termWidth - infoText.length))
          console.log(spaces + chalk.gray(infoText))
        }
      }
    }

    messages.push({ role: 'user', content: trimmed })
    const response = await askZyctra(messages)

    if (response) {
      messages.push({ role: 'assistant', content: response })
    }

    showPrompt()
  })

  showPrompt()
}
