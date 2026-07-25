import inquirer from 'inquirer'
import chalk from 'chalk'
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

let _supabase = null
function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || 'https://ewqcetzyzjhdzbyxphla.supabase.co'
    const key = process.env.SUPABASE_KEY || ''
    if (!key) throw new Error('SUPABASE_KEY not set')
    _supabase = createClient(url, key)
  }
  return _supabase
}

export async function signup() {
  console.log(chalk.cyan('\n✸ Create your Zyctra account\n'))

  const { fullName, email, password, confirmPassword } = await inquirer.prompt([
    { type: 'input',    name: 'fullName',         message: 'Full name:' },
    { type: 'input',    name: 'email',             message: 'Email:' },
    { type: 'password', name: 'password',          message: 'Password (min 8 chars):', mask: '*' },
    { type: 'password', name: 'confirmPassword',   message: 'Confirm password:',        mask: '*' },
  ])

  if (password !== confirmPassword) {
    console.log(chalk.red('\n✗ Passwords do not match\n'))
    return
  }

  if (password.length < 8) {
    console.log(chalk.red('\n✗ Password must be at least 8 characters\n'))
    return
  }

  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) {
    console.log(chalk.red('\n✗ Signup failed:', error.message, '\n'))
    return
  }

  console.log(chalk.green('\n✓ Account created successfully!'))
  console.log(chalk.gray('Check your email to confirm your account.'))
  console.log(chalk.gray('Then run: zyctra login\n'))
}
