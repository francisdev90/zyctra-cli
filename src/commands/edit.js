import fs from 'fs'
import path from 'path'
import readline from 'readline'
import chalk from 'chalk'
import { askZyctraAndReturn } from '../ai.js'
import { config } from '../config.js'
import { readFile } from '../utils/fileReader.js'

function showDiff(original, edited) {
  const origLines = original.split('\n')
  const editLines = edited.split('\n')
  const maxLen    = Math.max(origLines.length, editLines.length)
  let hasChanges  = false

  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i]
    const edit = editLines[i]

    if (orig === undefined) {
      console.log(chalk.green(`  + ${edit}`))
      hasChanges = true
    } else if (edit === undefined) {
      console.log(chalk.red(`  - ${orig}`))
      hasChanges = true
    } else if (orig !== edit) {
      console.log(chalk.red(`  - ${orig}`))
      console.log(chalk.green(`  + ${edit}`))
      hasChanges = true
    }
  }

  return hasChanges
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

export async function editFile(file, instruction) {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.red('\n✗ Please login first: zyctra login\n'))
    return
  }

  if (!file) {
    console.log(chalk.red('\n✗ Please specify a file: zyctra edit <filename>\n'))
    return
  }

  const engine = config.get('engine') || 'vora'

  console.log(chalk.cyan(`\n  Reading ${file}...`))

  let fileData
  try {
    fileData = await readFile(file)
  } catch (err) {
    console.log(chalk.red(`\n✗ ${err.message}\n`))
    return
  }

  if (fileData.type === 'image') {
    console.log(chalk.yellow('\n⚠  Cannot edit image files. Use: zyctra read <image>\n'))
    return
  }

  const lineCount = fileData.content.split('\n').length
  console.log(chalk.gray(`  ✓ Loaded ${file} (${lineCount} lines)\n`))

  const instructionPart = instruction ? `\n\nInstruction: ${instruction}` : ''

  const messages = [{
    role: 'user',
    content: `You are editing a file. Read it carefully and return the complete improved version.${instructionPart}

${fileData.textContent}

Respond in exactly this format (no extra text before or after):
WHAT_I_CHANGED:
[bullet list of specific changes made, one per line]

EDITED_FILE:
[complete corrected file content only, no markdown fences]`,
  }]

  console.log(chalk.cyan('  Analyzing...\n'))

  const response = await askZyctraAndReturn(messages, engine)

  if (!response) return

  // Parse structured response
  const changesMatch = response.match(/WHAT_I_CHANGED:\n([\s\S]*?)(?:\n\nEDITED_FILE:|\nEDITED_FILE:)/i)
  const fileMatch    = response.match(/EDITED_FILE:\n([\s\S]*)$/i)

  const changes = changesMatch ? changesMatch[1].trim() : null
  let editedContent = fileMatch ? fileMatch[1].trim() : null

  if (!editedContent) {
    const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/)
    editedContent = codeMatch ? codeMatch[1].trim() : response.trim()
  }

  // Strip accidental markdown fences
  editedContent = editedContent
    .replace(/^```[\w]*\r?\n?/, '')
    .replace(/\r?\n?```$/, '')
    .trim()

  // Show what changed
  console.log(chalk.bold.white('  What I changed:'))
  if (changes) {
    changes.split('\n').forEach(line => console.log(chalk.gray('  ' + line)))
  }
  console.log()

  // Show diff
  console.log(chalk.bold.white('  Diff:'))
  console.log(chalk.gray('  ' + '─'.repeat(Math.min(process.stdout.columns - 4, 60))))

  const hasChanges = showDiff(fileData.content, editedContent)

  if (!hasChanges) {
    console.log(chalk.gray('  No changes needed.\n'))
    return
  }

  console.log(chalk.gray('  ' + '─'.repeat(Math.min(process.stdout.columns - 4, 60))))
  console.log()

  const answer = await confirm(chalk.cyan('  Apply these changes? (y/n): '))

  if (answer === 'y' || answer === 'yes') {
    const fullPath = path.resolve(file)
    fs.copyFileSync(fullPath, fullPath + '.bak')
    fs.writeFileSync(fullPath, editedContent + '\n')
    console.log(chalk.green(`\n  ✓ Changes applied to ${file}`))
    console.log(chalk.gray(`  Backup saved: ${file}.bak\n`))
  } else {
    console.log(chalk.gray('\n  Changes discarded.\n'))
  }
}
