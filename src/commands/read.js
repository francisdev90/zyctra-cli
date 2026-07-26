import chalk from 'chalk'
import inquirer from 'inquirer'
import { askZyctra } from '../ai.js'
import { config } from '../config.js'
import { readFile } from '../utils/fileReader.js'

export async function read(file) {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.yellow('\n⚠  Please login first: zyctra login\n'))
    return
  }

  const engine = config.get('engine') || 'vora'

  console.log(chalk.cyan(`\n✦ Reading ${file}...\n`))

  try {
    const fileData = await readFile(file)
    console.log(chalk.green(`✓ Loaded: ${fileData.name}\n`))

    const { question } = await inquirer.prompt([{
      type:    'input',
      name:    'question',
      message: 'What would you like to know about this file?',
      default: fileData.type === 'image'
        ? 'Describe this image in detail'
        : 'Explain what this file does',
    }])

    const messages = [{ role: 'user', content: question }]

    if (fileData.type === 'image') {
      await askZyctra(messages, engine, [fileData])
    } else {
      messages[0].content = `${question}\n\n${fileData.textContent}`
      await askZyctra(messages, engine)
    }
  } catch (error) {
    console.log(chalk.red(`\n✗ ${error.message}\n`))
  }
}
