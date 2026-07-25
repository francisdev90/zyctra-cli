import inquirer from 'inquirer'
import chalk from 'chalk'
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

let supabase = null
function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || 'https://ewqcetzyzjhdzbyxphla.supabase.co'
    const key = process.env.SUPABASE_KEY || ''
    if (!key) throw new Error('SUPABASE_KEY not set')
    supabase = createClient(url, key)
  }
  return supabase
}

export async function login() {
  console.log(chalk.cyan('\n✦ Zyctra CLI — AI that remembers you\n'))

  const { email, password } = await inquirer.prompt([
    { type: 'input',    name: 'email',    message: 'Email:' },
    { type: 'password', name: 'password', message: 'Password:', mask: '*' },
  ])

  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })

  if (error) {
    console.log(chalk.red('\n✗ Login failed:', error.message, '\n'))
    return
  }

  const { data: userData } = await getSupabase()
    .from('users')
    .select('plan, role, id, full_name')
    .eq('email', email)
    .single()

  const plan = userData?.role === 'founder' ? 'founder' : (userData?.plan || 'free')

  const engineMap = {
    free:    'zev',
    pro:     'vora',
    premium: 'talyn',
    founder: 'talyn',
  }
  const engine = engineMap[plan] || 'vora'

  config.set('token', data.session.access_token)
  config.set('email', email)
  config.set('plan', plan)
  config.set('engine', engine)
  config.set('userId', userData?.id)
  config.set('isFounder', userData?.role === 'founder')

  console.log(chalk.green('\n✓ Logged in successfully!'))
  console.log(chalk.cyan(`✸ Plan: ${plan} · Engine: ${engine}\n`))
}
