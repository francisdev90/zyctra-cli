import chalk from 'chalk'
import { askZyctra } from '../ai.js'
import { config } from '../config.js'
import { readFile } from '../utils/fileReader.js'

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

  const engine = config.get('engine') || 'vora'

  console.log(chalk.cyan(`\n✦ Reading ${file}...\n`))

  try {
    const fileData = await readFile(file)

    if (fileData.type === 'image') {
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
