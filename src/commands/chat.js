import readline from 'readline'
import fs from 'fs'
import chalk from 'chalk'
import { config } from '../config.js'
import { askZyctra, getUsageStats } from '../ai.js'
import { readFile } from '../utils/fileReader.js'
import { readUrl } from '../utils/urlReader.js'
import { searchWeb } from '../utils/webSearch.js'

const SEARCH_KEYWORDS = ['search', 'find', 'latest', 'current', 'today', 'news', 'what is', 'who is', 'when did', 'where is']

const vis = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length
const pad = (s, len) => s + ' '.repeat(Math.max(0, len - vis(s)))

function showWelcome(engine, email, plan) {
  const isFounder   = config.get('isFounder') || email === 'henryfrancis238@gmail.com'
  const engineLabel = isFounder ? 'Talyn (Max)' : engine.charAt(0).toUpperCase() + engine.slice(1)
  const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1)
  const cols        = Math.min(process.stdout.columns || 80, 120)

  const innerWidth = cols - 4
  const leftWidth  = Math.floor(innerWidth * 0.42)
  const rightWidth = innerWidth - leftWidth - 3

  const leftLines = [
    '',
    `  ${chalk.cyan('✸')}  ${chalk.bold.white('Zyctra')}  ${chalk.cyan('✸')}`,
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
    chalk.bold.white('Tips for getting started'),
    chalk.gray('Paste any file path in chat to read it,'),
    chalk.gray('ask Zyctra to edit, fix, or explain.'),
    '',
    chalk.bold.white("What's new"),
    `${chalk.cyan('•')} ${chalk.gray('Read & edit files directly in chat')}`,
    `${chalk.cyan('•')} ${chalk.gray('Reads screenshots and images too')}`,
    `${chalk.cyan('•')} ${chalk.gray('Run: zyctra edit <file>')}`,
    '',
  ]

  const VERSION   = 'Zyctra CLI v1.0.9'
  const dashLeft  = Math.floor((cols - 2 - VERSION.length - 2) / 2)
  const dashRight = cols - 2 - VERSION.length - 2 - dashLeft
  const maxRows   = Math.max(leftLines.length, rightLines.length)

  const out = []

  out.push(
    chalk.cyan('╭') +
    chalk.cyan('─'.repeat(dashLeft)) +
    ' ' + chalk.bold.white(VERSION) + ' ' +
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

const FILE_EXT_RE = /\.(js|ts|jsx|tsx|py|json|md|txt|html|css|png|jpg|jpeg|gif|webp|pdf|sql|yaml|yml|xml|sh|go|rs|rb|java|cpp|c|php|env|gitignore)$/i

function extractFilePaths(text) {
  const found = []
  const re = /(?:^|[\s"'`])(\.{0,2}[/\\]?[\w\-./ \\]+\.\w+)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const p = m[1].trim()
    if (FILE_EXT_RE.test(p) && fs.existsSync(p)) {
      found.push(p)
    }
  }
  return [...new Set(found)]
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

  const divider   = () => console.log(chalk.gray('─'.repeat(process.stdout.columns || 80)))
  const showPrompt = () => {
    divider()
    rl.setPrompt(chalk.cyan('❯ '))
    rl.prompt()
  }

  rl.on('line', async (input) => {
    const trimmed = input.trim()
    if (!trimmed) { rl.prompt(); return }

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
          const t = `✗ Usage limit reached · Resets at ${resetTime} · Upgrade at zyctra.com/plans`
          console.log(' '.repeat(Math.max(0, termWidth - t.length)) + chalk.red(t))
          rl.setPrompt(chalk.cyan('❯ '))
          rl.prompt()
          return
        } else if (percentage >= 80) {
          const t = `⚠ ${percentage}% used · Resets at ${resetTime}`
          console.log(' '.repeat(Math.max(0, termWidth - t.length)) + chalk.yellow(t))
        } else {
          const t = `${percentage}% used · Resets at ${resetTime}`
          console.log(' '.repeat(Math.max(0, termWidth - t.length)) + chalk.gray(t))
        }
      }
    }

    // Auto-detect URLs and file paths in the message and load them
    const attachments   = []
    let enrichedContent = trimmed

    // Web search intent detection
    const needsSearch = SEARCH_KEYWORDS.some(k => trimmed.toLowerCase().includes(k))
    if (needsSearch) {
      console.log(chalk.cyan('\n  🔍 Searching the web...'))
      const searchResults = await searchWeb(trimmed)
      if (searchResults) {
        enrichedContent += `\n\n[Web Search Results]\n${searchResults}`
        console.log(chalk.gray('  ✓ Web search complete\n'))
      }
    }

    // URLs
    const urlMatches = [...trimmed.matchAll(/(https?:\/\/[^\s]+|www\.[^\s]+)/g)].map(m => m[1])
    for (const url of urlMatches) {
      try {
        console.log(chalk.cyan(`\n  Fetching ${url}...`))
        const urlData = await readUrl(url)
        enrichedContent += `\n\n[Page: ${urlData.title}]\n${urlData.content}`
        console.log(chalk.gray(`  ✓ Loaded: ${urlData.title || url}\n`))
      } catch (err) {
        console.log(chalk.yellow(`  ⚠ Could not fetch ${url}: ${err.message}\n`))
      }
    }

    // File paths
    const filePaths = extractFilePaths(trimmed)
    for (const filePath of filePaths) {
      try {
        console.log(chalk.cyan(`\n  Reading ${filePath}...`))
        const fileData = await readFile(filePath)
        if (fileData.type === 'image') {
          attachments.push(fileData)
          console.log(chalk.gray(`  ✓ Loaded image: ${filePath}\n`))
        } else {
          enrichedContent += `\n\n${fileData.textContent}`
          console.log(chalk.gray(`  ✓ Loaded ${filePath} (${fileData.content.split('\n').length} lines)\n`))
        }
      } catch (err) {
        console.log(chalk.yellow(`  ⚠ Could not read ${filePath}: ${err.message}\n`))
      }
    }

    messages.push({ role: 'user', content: enrichedContent })
    const response = await askZyctra(messages, engine, attachments)

    if (response) {
      messages.push({ role: 'assistant', content: response })
    }

    showPrompt()
  })

  showPrompt()
}
