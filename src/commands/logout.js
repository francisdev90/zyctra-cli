import chalk from 'chalk'
import { config } from '../config.js'

export async function logout() {
  config.delete('token')
  config.delete('email')
  console.log(chalk.green('\n✓ Logged out successfully\n'))
}
