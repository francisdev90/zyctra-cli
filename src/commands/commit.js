import { execSync } from 'child_process'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { askZyctra } from '../ai.js'
import { config } from '../config.js'

export async function commit() {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.yellow('\n⚠  Please login first: zyctra login\n'))
    return
  }

  let diff
  try {
    diff = execSync('git diff --staged', { encoding: 'utf-8' })
  } catch {
    console.log(chalk.red('\n✗ Not a git repository or git is not installed.\n'))
    return
  }

  if (!diff.trim()) {
    console.log(chalk.yellow('\n⚠  No staged changes found. Stage your changes first:\n'))
    console.log(chalk.gray('   git add <files>\n'))
    return
  }

  if (diff.length > 50_000) {
    console.log(chalk.yellow('\n⚠  Diff is very large — only the first 50,000 chars will be analysed.\n'))
  }

  console.log(chalk.cyan('\n✦ Generating commit message...\n'))

  const messages = [{
    role:    'user',
    content: `Generate a concise git commit message for the following diff. Use the conventional commits format (e.g. feat:, fix:, refactor:, docs:, etc.). Output only the commit message, nothing else:\n\n${diff.slice(0, 50_000)}`,
  }]

  const suggestion = await askZyctra(messages, 'zev')
  if (!suggestion) return

  const cleaned = suggestion.trim().replace(/^["']|["']$/g, '')

  const { action } = await inquirer.prompt([{
    type:    'list',
    name:    'action',
    message: 'What would you like to do?',
    choices: [
      { name: 'Use this message', value: 'use' },
      { name: 'Edit message',     value: 'edit' },
      { name: 'Cancel',           value: 'cancel' },
    ],
  }])

  if (action === 'cancel') {
    console.log(chalk.gray('\n  Commit cancelled.\n'))
    return
  }

  let finalMessage = cleaned

  if (action === 'edit') {
    const { edited } = await inquirer.prompt([{
      type:    'input',
      name:    'edited',
      message: 'Edit message:',
      default: cleaned,
    }])
    finalMessage = edited.trim()
  }

  if (!finalMessage) {
    console.log(chalk.red('\n✗ Commit message cannot be empty.\n'))
    return
  }

  try {
    execSync(`git commit -m "${finalMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' })
    console.log(chalk.green('\n✓ Committed successfully!\n'))
  } catch {
    console.log(chalk.red('\n✗ Commit failed. Check the output above.\n'))
  }
}
