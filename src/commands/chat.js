import readline from 'readline'
import fs from 'fs'
import chalk from 'chalk'
import { config } from '../config.js'
import { askZyctra, getUsageStats, syncUserProfile } from '../ai.js'
import { readFile } from '../utils/fileReader.js'
import { readUrl } from '../utils/urlReader.js'
import { searchWeb } from '../utils/webSearch.js'

const VERSION = 'v1.1.6'

const SEARCH_KEYWORDS = ['search', 'find', 'latest', 'current', 'today', 'news', 'what is', 'who is', 'when did', 'where is']
const FILE_EXT_RE     = /\.(js|ts|jsx|tsx|py|json|md|txt|html|css|png|jpg|jpeg|gif|webp|pdf|sql|yaml|yml|xml|sh|go|rs|rb|java|cpp|c|php|env|gitignore)$/i
const ENGINE_LABEL    = { zev: 'Zev', vora: 'Vora', talyn: 'Talyn' }

// Strip ANSI escape codes to get visual width
const vis = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length
const pad = (s, len) => s + ' '.repeat(Math.max(0, len - vis(s)))

function showWelcome(engine, email, plan) {
  const isFounder   = config.get('isFounder') || false
  const engineLabel = ENGINE_LABEL[engine] || engine
  const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1)
  const cols        = process.stdout.columns || 80
  const innerWidth  = cols - 4
  const leftWidth   = Math.floor(innerWidth * 0.42)
  const rightWidth  = innerWidth - leftWidth - 3

  const leftLines = [
    '',
    `  ${chalk.cyan('◆')}  ${chalk.bold.white('Zyctra')}  ${chalk.cyan('◆')}`,
    '',
    `  ${chalk.gray('Engine')}  · ${chalk.cyan(engineLabel)}`,
    `  ${chalk.gray(email)}`,
    `  ${chalk.gray('Plan')}    · ${chalk.cyan(planLabel)}`,
    '',
    `  ${chalk.gray('zyctra.com')}`,
    '',
  ]

  const rightLines = [
    '',
    chalk.bold.white('Commands'),
    `${chalk.cyan('/help')}    ${chalk.gray('Show all commands')}`,
    `${chalk.cyan('/clear')}   ${chalk.gray('Clear chat history')}`,
    `${chalk.cyan('/engine')}  ${chalk.gray('Show current engine')}`,
    `${chalk.cyan('/plan')}    ${chalk.gray('Show your plan')}`,
    `${chalk.cyan('/exit')}    ${chalk.gray('Exit Zyctra')}`,
    '',
    chalk.gray('Tip: paste any file path to read it'),
    '',
  ]

  const versionStr = `Zyctra CLI ${VERSION}`
  const dashLeft   = Math.floor((cols - 2 - versionStr.length - 2) / 2)
  const dashRight  = cols - 2 - versionStr.length - 2 - dashLeft
  const maxRows    = Math.max(leftLines.length, rightLines.length)
  const out        = []

  out.push(
    chalk.cyan('╭') +
    chalk.cyan('─'.repeat(dashLeft)) +
    ' ' + chalk.bold.white(versionStr) + ' ' +
    chalk.cyan('─'.repeat(dashRight)) +
    chalk.cyan('╮')
  )

  for (let i = 0; i < maxRows; i++) {
    const l = pad(leftLines[i] ?? '', leftWidth)
    const r = pad(rightLines[i] ?? '', rightWidth)
    out.push(
      chalk.cyan('│') + ' ' + l + ' ' + chalk.cyan('│') + ' ' + r + ' ' + chalk.cyan('│')
    )
  }

  out.push(
    chalk.cyan('╰') +
    chalk.cyan('─'.repeat(leftWidth + 2)) +
    chalk.cyan('┴') +
    chalk.cyan('─'.repeat(rightWidth + 2)) +
    chalk.cyan('╯')
  )

  console.log(out.join('\n'))
}

function showHelp() {
  console.log('')
  console.log(chalk.bold.white('  Commands'))
  console.log(`  ${chalk.cyan('/help')}         Show this help`)
  console.log(`  ${chalk.cyan('/clear')}        Clear conversation history`)
  console.log(`  ${chalk.cyan('/engine')}       Show your current engine`)
  console.log(`  ${chalk.cyan('/plan')}         Show your plan details`)
  console.log(`  ${chalk.cyan('/exit')}         Exit Zyctra CLI`)
  console.log('')
  console.log(chalk.bold.white('  File & URL support'))
  console.log(`  ${chalk.gray('Paste any file path')}  ${chalk.gray('→ reads it into context')}`)
  console.log(`  ${chalk.gray('Paste any URL')}         ${chalk.gray('→ fetches and reads it')}`)
  console.log(`  ${chalk.gray('Paste an image path')}   ${chalk.gray('→ sends as vision input')}`)
  console.log('')
  console.log(chalk.bold.white('  Other commands'))
  console.log(`  ${chalk.cyan('zyctra fix <file>')}     Analyze and fix a file`)
  console.log(`  ${chalk.cyan('zyctra edit <file>')}    Edit a file with diff preview`)
  console.log(`  ${chalk.cyan('zyctra explain <file>')} Explain what a file does`)
  console.log(`  ${chalk.cyan('zyctra commit')}         Generate a git commit message`)
  console.log(`  ${chalk.cyan('zyctra scan [folder]')}  Scan an entire folder`)
  console.log(`  ${chalk.cyan('zyctra write <prompt>')} Generate a new file`)
  console.log('')
}

function extractFilePaths(text) {
  const found = []
  const re    = /(?:^|[\s"'`])(\.{0,2}[/\\]?[\w\-./ \\]+\.\w+)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const p = m[1].trim()
    if (FILE_EXT_RE.test(p) && fs.existsSync(p)) found.push(p)
  }
  return [...new Set(found)]
}

export async function chat(prompt) {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.red('\n✗ Please login first: zyctra login\n'))
    return
  }

  // Always sync engine + plan from DB on session start
  // so it matches what the user has set in the app — no re-login needed
  await syncUserProfile(token)

  const email     = config.get('email')     || ''
  const engine    = config.get('engine')    || 'vora'
  const plan      = config.get('plan')      || 'go'
  const isFounder = config.get('isFounder') || false

  showWelcome(engine, email, plan)

  // Show a one-time warning if approaching the usage limit
  if (!isFounder) {
    const { percentage, resetTime } = await getUsageStats(token)
    if (percentage >= 80) {
      const termWidth = process.stdout.columns || 80
      const t = percentage >= 100
        ? `⚠ Limit reached · Resets at ${resetTime} · zyctra.com/plans`
        : `⚠ ${percentage}% used · Resets at ${resetTime}`
      console.log(' '.repeat(Math.max(0, termWidth - t.length)) + chalk.yellow(t))
    }
  }

  const messages = []

  // One-shot mode (zyctra "ask something")
  if (prompt) {
    messages.push({ role: 'user', content: prompt })
    console.log(chalk.white(`\nYou: ${prompt}`))
    await askZyctra(messages)
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  rl.on('SIGINT', () => {
    console.log(chalk.cyan('\n\n✦ Goodbye!\n'))
    rl.close()
    process.exit(0)
  })

  const divider    = () => process.stdout.write(chalk.gray('─'.repeat(process.stdout.columns || 80)) + '\n')
  const showPrompt = () => {
    divider()
    rl.setPrompt(chalk.cyan('❯ '))
    rl.prompt()
  }

  rl.on('line', async (input) => {
    const trimmed = input.trim()
    if (!trimmed) { rl.prompt(); return }

    // ── Slash commands ──────────────────────────────────────────────
    if (trimmed.startsWith('/')) {
      const cmd = trimmed.toLowerCase().split(' ')[0]

      if (cmd === '/help') {
        showHelp()
        showPrompt()
        return
      }

      if (cmd === '/clear') {
        messages.length = 0
        console.log(chalk.gray('\n  Chat history cleared.\n'))
        showPrompt()
        return
      }

      if (cmd === '/engine') {
        const engineLabel = ENGINE_LABEL[engine] || engine
        console.log(chalk.cyan(`\n  Engine: ${engineLabel}`))
        console.log(chalk.gray('  Change your engine in the Zyctra app — it syncs automatically.\n'))
        showPrompt()
        return
      }

      if (cmd === '/plan') {
        const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1)
        const engineLabel = ENGINE_LABEL[engine] || engine
        console.log(chalk.cyan(`\n  Plan: ${planLabel}`))
        console.log(chalk.cyan(`  Engine: ${engineLabel}`))
        if (isFounder) console.log(chalk.cyan('  Role: Founder (unlimited access)'))
        console.log('')
        showPrompt()
        return
      }

      if (cmd === '/exit' || cmd === '/quit') {
        console.log(chalk.cyan('\n✦ Goodbye!\n'))
        rl.close()
        return
      }

      console.log(chalk.yellow(`\n  Unknown command: ${trimmed}`))
      console.log(chalk.gray('  Type /help to see available commands.\n'))
      showPrompt()
      return
    }

    // ── Regular message ─────────────────────────────────────────────
    divider()

    const attachments    = []
    let enrichedContent  = trimmed

    // Web search
    const needsSearch = SEARCH_KEYWORDS.some(k => trimmed.toLowerCase().includes(k))
    if (needsSearch) {
      process.stdout.write(chalk.gray('  Searching the web...\n'))
      const results = await searchWeb(trimmed)
      if (results) enrichedContent += `\n\n[Web Search Results]\n${results}`
    }

    // URLs
    const urlMatches = [...trimmed.matchAll(/(https?:\/\/[^\s]+|www\.[^\s]+)/g)].map(m => m[1])
    for (const url of urlMatches) {
      try {
        process.stdout.write(chalk.gray(`  Fetching ${url}...\n`))
        const urlData = await readUrl(url)
        enrichedContent += `\n\n[Page: ${urlData.title}]\n${urlData.content}`
      } catch (err) {
        console.log(chalk.yellow(`  ⚠ Could not fetch ${url}: ${err.message}`))
      }
    }

    // File paths
    const filePaths = extractFilePaths(trimmed)
    for (const filePath of filePaths) {
      try {
        process.stdout.write(chalk.gray(`  Reading ${filePath}...\n`))
        const fileData = await readFile(filePath)
        if (fileData.type === 'image') {
          attachments.push(fileData)
        } else {
          enrichedContent += `\n\n${fileData.textContent}`
        }
      } catch (err) {
        console.log(chalk.yellow(`  ⚠ Could not read ${filePath}: ${err.message}`))
      }
    }

    console.log('')
    messages.push({ role: 'user', content: enrichedContent })
    const response = await askZyctra(messages, engine, attachments)

    if (response) messages.push({ role: 'assistant', content: response })

    showPrompt()
  })

  showPrompt()
}
