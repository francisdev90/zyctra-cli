import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { askZyctra } from '../ai.js'
import { config } from '../config.js'
import { readFile } from '../utils/fileReader.js'

export async function fix(file, options = {}) {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.yellow('\n⚠  Please login first: zyctra login\n'))
    return
  }

  if (!file) {
    console.log(chalk.red('\n✗ Please specify a file: zyctra fix <filename>\n'))
    return
  }

  const engine = config.get('engine') || 'vora'

  console.log(chalk.cyan(`\n✦ Reading ${file}...\n`))

  try {
    const fileData = await readFile(file)

    if (options.write) {
      if (fileData.type === 'image') {
        console.log(chalk.yellow('⚠  --write is not supported for image files.\n'))
        return
      }

      console.log(chalk.cyan('✦ Fixing...\n'))

      const messages = [{
        role:    'user',
        content: `Fix this code. Return ONLY the complete fixed code with no explanation, no markdown, no backticks — just the raw code:\n\n${fileData.textContent}`,
      }]

      const fixedCode = await askZyctra(messages, engine, [], { silent: true })

      if (fixedCode) {
        // Strip any accidental markdown fences the AI may add despite instructions
        const cleaned  = fixedCode.replace(/^```[\w]*\r?\n?/, '').replace(/\r?\n?```$/, '').trim()
        const fullPath = path.resolve(file)
        fs.copyFileSync(fullPath, fullPath + '.bak')
        fs.writeFileSync(fullPath, cleaned + '\n')
        console.log(chalk.green(`✓ Fixed and saved: ${file}\n`))
        console.log(chalk.gray(`  Backup saved: ${file}.bak\n`))
      }

    } else if (fileData.type === 'image') {
      const messages = [{
        role:    'user',
        content: 'Please analyze this image and describe what you see. If it contains UI/design elements, suggest improvements.',
      }]
      await askZyctra(messages, engine, [fileData])
    } else {
      const messages = [{
        role:    'user',
        content: `Please analyse this file for bugs, errors, and improvements. Show the fixed version with brief explanations of each change:\n\n${fileData.textContent}`,
      }]
      await askZyctra(messages, engine)
    }
  } catch (error) {
    console.log(chalk.red(`\n✗ ${error.message}\n`))
  }
}
