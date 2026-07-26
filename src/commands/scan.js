import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { askZyctra } from '../ai.js'
import { config } from '../config.js'

const SUPPORTED_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.py', '.html', '.css', '.json', '.md',
  '.php', '.java', '.cpp', '.c', '.go', '.rs', '.sql', '.yaml', '.yml', '.sh',
]
const MAX_FILES    = 20
const MAX_FILE_SIZE = 100 * 1024 // 100 KB per file
const SKIP_DIRS    = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '__pycache__'])

export async function scan(folder = '.') {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.yellow('\n⚠  Please login first: zyctra login\n'))
    return
  }

  const engine     = config.get('engine') || 'vora'
  const folderPath = path.resolve(folder)

  if (!fs.existsSync(folderPath)) {
    console.log(chalk.red(`\n✗ Folder not found: ${folder}\n`))
    return
  }

  console.log(chalk.cyan(`\n✸ Scanning ${folder}...\n`))

  const files = []

  function collectFiles(dir, depth = 0) {
    if (depth > 5 || files.length >= MAX_FILES) return
    const items = fs.readdirSync(dir)
    for (const item of items) {
      if (files.length >= MAX_FILES) break
      if (item.startsWith('.') || SKIP_DIRS.has(item)) continue
      const fullPath = path.join(dir, item)
      const stat     = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        collectFiles(fullPath, depth + 1)
      } else if (SUPPORTED_EXTENSIONS.includes(path.extname(item).toLowerCase())) {
        if (stat.size <= MAX_FILE_SIZE) files.push(fullPath)
      }
    }
  }

  try {
    collectFiles(folderPath)
  } catch (error) {
    console.log(chalk.red(`\n✗ ${error.message}\n`))
    return
  }

  if (files.length === 0) {
    console.log(chalk.yellow('\n⚠  No supported files found in this folder\n'))
    return
  }

  console.log(chalk.gray(`Found ${files.length} file${files.length !== 1 ? 's' : ''} to analyze...\n`))

  let content =
    `Please analyze this codebase and provide:\n` +
    `1. Bugs and errors found\n` +
    `2. Security issues\n` +
    `3. Performance improvements\n` +
    `4. Code quality suggestions\n` +
    `5. Overall assessment\n\n` +
    `Files:\n\n`

  for (const file of files) {
    const relativePath  = path.relative(folderPath, file)
    const fileContent   = fs.readFileSync(file, 'utf-8')
    const ext           = path.extname(file).slice(1)
    content += `--- ${relativePath} ---\n\`\`\`${ext}\n${fileContent}\n\`\`\`\n\n`
  }

  const messages = [{ role: 'user', content }]
  await askZyctra(messages, engine)
}
