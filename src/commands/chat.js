import readline from 'readline'
import chalk from 'chalk'
import boxen from 'boxen'
import { config } from '../config.js'
import { askZyctra, getUsageStats } from '../ai.js'

function showWelcome(engine, email, plan) {
  const isFounder   = config.get('isFounder') || email === 'henryfrancis238@gmail.com'
  const engineLabel = isFounder ? 'Talyn (Max)' : engine.charAt(0).toUpperCase() + engine.slice(1)
  const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1)
  const cols        = process.stdout.columns || 80

  const content =
    `${chalk.cyan('✸')}  ${chalk.bold.white('Zyctra')}  ${chalk.cyan('✸')}` +
    ' '.repeat(Math.max(0, cols - 40)) +
    `${chalk.gray('zyctra.com')}\n` +
    `${chalk.gray('AI that remembers you')}  ·  ` +
    `${chalk.gray('Engine')} · ${chalk.cyan(engineLabel)} · ${chalk.gray(email)} · ${chalk.cyan(planLabel)}\n` +
    `${chalk.gray('─'.repeat(cols - 4))}\n` +
    `${chalk.white('zyctra "question"')}          ${chalk.gray('Ask anything')}\n` +
    `${chalk.white('zyctra fix file.js')}         ${chalk.gray('Fix bugs in a file')}\n` +
    `${chalk.white('zyctra fix file.js --write')} ${chalk.gray('Auto-fix and save file')}\n` +
    `${chalk.white('zyctra explain file')}        ${chalk.gray('Explain a file')}\n` +
    `${chalk.white('zyctra read file.png')}       ${chalk.gray('Analyze any file or image')}\n` +
    `${chalk.white('zyctra read img.png --fix')}  ${chalk.gray('Generate code from image')}\n` +
    `${chalk.white('zyctra scan [folder]')}       ${chalk.gray('Scan entire folder for issues')}\n` +
    `${chalk.white('zyctra write "prompt"')}      ${chalk.gray('Generate and save new file')}\n` +
    `${chalk.white('zyctra commit')}              ${chalk.gray('Generate commit message')}\n` +
    `${chalk.white('zyctra plans')}               ${chalk.gray('View plans and pricing')}\n` +
    `${chalk.white('zyctra upgrade')}             ${chalk.gray('Upgrade your plan')}\n` +
    `${chalk.white('zyctra logout')}              ${chalk.gray('Logout')}\n` +
    `${chalk.gray('─'.repeat(cols - 4))}\n` +
    `${chalk.gray('Type your message below. Ctrl+C to exit.')}`

  console.log(boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: 0,
    borderStyle: 'round',
    borderColor: 'cyan',
    title: chalk.cyan('✸ Zyctra CLI v1.0.6'),
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
