import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { askZyctra } from '../ai.js'
import { config } from '../config.js'

export async function write(prompt, options = {}) {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.yellow('\n⚠  Please login first: zyctra login\n'))
    return
  }

  const engine = config.get('engine') || 'vora'

  const instruction =
    `${prompt}\n\n` +
    `Return ONLY the complete code with no explanation, no markdown backticks — just the raw code ready to save to a file.`

  console.log(chalk.cyan('\n✸ Generating...\n'))

  const messages  = [{ role: 'user', content: instruction }]
  const response  = await askZyctra(messages, engine, [], { silent: true })

  if (!response) return

  // Strip accidental markdown fences
  const cleaned = response.replace(/^```[\w]*\r?\n?/, '').replace(/\r?\n?```$/, '').trim()

  // Print to terminal so user can see it
  console.log(chalk.white(cleaned) + '\n')

  if (options.output) {
    const outputPath = path.resolve(options.output)
    fs.writeFileSync(outputPath, cleaned + '\n')
    console.log(chalk.green(`✓ Saved to: ${options.output}\n`))
  } else {
    const { filename } = await inquirer.prompt([{
      type:    'input',
      name:    'filename',
      message: 'Save to file (leave blank to skip):',
    }])

    if (filename.trim()) {
      fs.writeFileSync(path.resolve(filename.trim()), cleaned + '\n')
      console.log(chalk.green(`✓ Saved to: ${filename.trim()}\n`))
    }
  }
}
