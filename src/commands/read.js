import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { askZyctra } from '../ai.js'
import { config } from '../config.js'
import { readFile } from '../utils/fileReader.js'

export async function read(file, options = {}) {
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

    if (options.fix) {
      const messages = fileData.type === 'image'
        ? [{
            role:    'user',
            content: 'Analyze this screenshot or image carefully. Generate the complete code to recreate or fix what you see. Return ONLY the raw code — no explanation, no markdown backticks.',
          }]
        : [{
            role:    'user',
            content: `Fix and improve this code. Return ONLY the complete fixed file — no explanation, no markdown backticks:\n\n${fileData.textContent}`,
          }]

      const response = fileData.type === 'image'
        ? await askZyctra(messages, engine, [fileData])
        : await askZyctra(messages, engine)

      if (response) {
        const { filename } = await inquirer.prompt([{
          type:    'input',
          name:    'filename',
          message: 'Save to file (leave blank to skip):',
        }])

        if (filename.trim()) {
          const cleaned = response.replace(/^```[\w]*\r?\n?/, '').replace(/\r?\n?```$/, '').trim()
          fs.writeFileSync(path.resolve(filename.trim()), cleaned + '\n')
          console.log(chalk.green(`✓ Saved to: ${filename.trim()}\n`))
        }
      }
      return
    }

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
