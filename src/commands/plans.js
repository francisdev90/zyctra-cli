import chalk from 'chalk'
import open from 'open'
import inquirer from 'inquirer'

export async function plans() {
  console.log(chalk.cyan('\n✸ Zyctra Plans\n'))

  console.log(chalk.bold.white('Chat Plans:'))
  console.log(`  ${chalk.white('Free')}      ${chalk.gray('$0/mo')}   ${chalk.gray('Zev engine · Limited messages')}`)
  console.log(`  ${chalk.white('Pro')}       ${chalk.cyan('$15/mo')}  ${chalk.gray('Vora engine · Generous usage')}`)
  console.log(`  ${chalk.white('Premium')}   ${chalk.cyan('$20/mo')}  ${chalk.gray('Talyn engine · High usage')}\n`)

  console.log(chalk.bold.white('Image Plans:'))
  console.log(`  ${chalk.white('Starter')}   ${chalk.cyan('$8/mo')}   ${chalk.gray('30 images/month')}`)
  console.log(`  ${chalk.white('Pro')}       ${chalk.cyan('$15/mo')}  ${chalk.gray('80 images/month')}`)
  console.log(`  ${chalk.white('Business')} ${chalk.cyan('$25/mo')}  ${chalk.gray('150 images/month')}\n`)

  console.log(chalk.gray('Yearly plans available with 15% discount\n'))
  console.log(chalk.gray('Your Zyctra plan works across web, CLI, and all extensions.\n'))

  const { action } = await inquirer.prompt([{
    type:    'list',
    name:    'action',
    message: 'What would you like to do?',
    choices: [
      { name: 'Upgrade my plan (opens zyctra.com in browser)', value: 'upgrade' },
      { name: 'Exit', value: 'exit' },
    ],
  }])

  if (action === 'upgrade') {
    console.log(chalk.cyan('\n✸ Opening zyctra.com/plans in your browser...\n'))
    await open('https://zyctra-gamma.vercel.app/plans')
    console.log(chalk.gray('Complete your payment in the browser.'))
    console.log(chalk.gray('Your plan updates automatically after payment.\n'))
  }
}
