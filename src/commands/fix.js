import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { askZyctra } from '../ai.js'
import { config } from '../config.js'

export async function fix(file) {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.yellow('\n⚠  Please login first: zyctra login\n'))
    return
  }

  if (!file) {
    console.log(chalk.red('\n✗ Please specify a file: zyctra fix <filename>\n'))
    return
  }

  const filepath = path.resolve(file)
  if (!fs.existsSync(filepath)) {
    console.log(chalk.red(`\n✗ File not found: ${file}\n`))
    return
  }

  const content = fs.readFileSync(filepath, 'utf-8')
  if (content.length > 50_000) {
    console.log(chalk.yellow('\n⚠  File is very large — only the first 50,000 chars will be analysed.\n'))
  }

  console.log(chalk.cyan(`\n✦ Analysing ${file} for bugs...\n`))

  const messages = [{
    role:    'user',
    content: `Please analyse this code for bugs, errors, and improvements. Show the fixed version with brief explanations of each change:\n\n\`\`\`\n${content.slice(0, 50_000)}\n\`\`\``,
  }]

  await askZyctra(messages, 'vora')
}
