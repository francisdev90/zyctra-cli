import inquirer from 'inquirer'
import chalk from 'chalk'
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

const SUPABASE_URL  = 'https://ewqcetzyzjhdzbyxphla.supabase.co'
const SUPABASE_KEY  = 'sb_publishable_PcVlEjFAHPGvNqTo3jZieg_jTTv0sSc'
const FOUNDER_EMAIL = 'henryfrancis238@gmail.com'
const PAID_PLANS    = new Set(['go', 'pro', 'premium'])

const ENGINE_LABEL  = { zev: 'Zev', vora: 'Vora', talyn: 'Talyn' }

let supabase = null
function getSupabase() {
  if (!supabase) supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
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
    .select('plan, role, id, full_name, preferred_engine')
    .eq('email', email)
    .single()

  const isFounder = userData?.role === 'founder' || email.toLowerCase() === FOUNDER_EMAIL
  const plan      = isFounder ? 'premium' : (userData?.plan || 'free')

  if (!isFounder && !PAID_PLANS.has(plan)) {
    console.log(chalk.red('\n✗ Zyctra CLI requires a paid plan.'))
    console.log(chalk.gray(`  You're on the Free plan. Upgrade at zyctra.com/plans\n`))
    return
  }

  const ALLOWED_ENGINES = {
    go:      ['zev', 'vora'],
    pro:     ['zev', 'vora'],
    premium: ['zev', 'vora', 'talyn'],
    founder: ['zev', 'vora', 'talyn'],
  }
  const rawEngine  = userData?.preferred_engine || 'vora'
  const allowed    = isFounder ? ['zev', 'vora', 'talyn'] : (ALLOWED_ENGINES[plan] || ['zev', 'vora'])
  const engine     = allowed.includes(rawEngine) ? rawEngine : 'vora'

  config.set('token',     data.session.access_token)
  config.set('email',     email)
  config.set('plan',      plan)
  config.set('engine',    engine)
  config.set('userId',    userData?.id)
  config.set('isFounder', isFounder)

  const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1)
  const engineLabel = ENGINE_LABEL[engine] || engine

  console.log(chalk.green('\n✓ Logged in successfully!'))
  console.log(chalk.cyan(`✸ Plan: ${planLabel} · Engine: ${engineLabel}\n`))
}
