import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import ora from 'ora'
import { config } from './config.js'

const PLAN_LIMITS = {
  free:    { window: 5,        daily: 15  },
  pro:     { window: 20,       daily: 60  },
  premium: { window: 50,       daily: 150 },
  founder: { window: Infinity, daily: Infinity },
}

let client = null
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set')
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

function getSupabase(token) {
  const url = process.env.SUPABASE_URL || 'https://ewqcetzyzjhdzbyxphla.supabase.co'
  const key = process.env.SUPABASE_KEY || ''
  if (!key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

function getUserIdFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    return payload.sub
  } catch {
    return null
  }
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function checkUsageLimits(token) {
  if (!token || config.get('isFounder')) return { allowed: true }

  try {
    const supabase = getSupabase(token)
    if (!supabase) return { allowed: true }

    const userId = config.get('userId') || getUserIdFromToken(token)
    if (!userId) return { allowed: true }

    const plan   = config.get('plan') || 'free'
    const limits = PLAN_LIMITS[plan]  || PLAN_LIMITS.free

    if (limits.window === Infinity) return { allowed: true }

    const now          = new Date()
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString()
    const today        = now.toISOString().split('T')[0]

    const { data: windowMsgs } = await supabase
      .from('usage')
      .select('created_at')
      .eq('user_id', userId)
      .eq('type', 'message')
      .gte('created_at', threeHoursAgo)
      .order('created_at', { ascending: true })

    const windowCount = windowMsgs?.length ?? 0
    if (windowCount >= limits.window) {
      const oldest  = new Date(windowMsgs[0].created_at)
      const resetAt = new Date(oldest.getTime() + 3 * 60 * 60 * 1000)
      return { allowed: false, message: `✗ You've used your 3-hour limit. Resets at ${formatTime(resetAt)}` }
    }

    const { data: dailyMsgs } = await supabase
      .from('usage')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'message')
      .eq('date', today)

    const dailyCount = dailyMsgs?.length ?? 0
    if (dailyCount >= limits.daily) {
      const midnight = new Date(now)
      midnight.setDate(midnight.getDate() + 1)
      midnight.setHours(0, 0, 0, 0)
      return { allowed: false, message: `✗ You've used your daily limit. Resets at ${formatTime(midnight)}` }
    }

    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}

async function recordUsage(token, userId, engine) {
  try {
    const supabase = getSupabase(token)
    if (!supabase || !userId) return
    await supabase.from('usage').insert({
      user_id:    userId,
      type:       'message',
      engine:     engine,
      date:       new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    })
  } catch {
    // silently ignore — don't block the user if recording fails
  }
}

const MODEL_MAP = {
  zev:   'claude-haiku-4-5-20251001',
  vora:  'claude-sonnet-4-6',
  talyn: 'claude-opus-4-7',
}

const SYSTEM_PROMPT = `You are Zyctra, a premium AI assistant built by Francis Shakur — a web and software developer based in Nigeria. Learn more at francisshakur.com. He has also built Invlyra (invlyra.com) and CoinGlance (coinglance.app). Never mention Claude or Anthropic. You help developers write, debug, explain, and improve code. You are running in a terminal environment. Use plain text formatting — avoid unnecessary markdown decorations.`

export async function getUsageStats(token) {
  if (!token || config.get('isFounder')) return {}
  try {
    const supabase = getSupabase(token)
    if (!supabase) return {}
    const userId = config.get('userId') || getUserIdFromToken(token)
    if (!userId) return {}
    const plan   = config.get('plan') || 'free'
    const limits = PLAN_LIMITS[plan]  || PLAN_LIMITS.free
    if (limits.window === Infinity) return {}
    const now          = new Date()
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString()
    const { data: windowMsgs } = await supabase
      .from('usage').select('created_at')
      .eq('user_id', userId).eq('type', 'message')
      .gte('created_at', threeHoursAgo).order('created_at', { ascending: true })
    const windowCount = windowMsgs?.length ?? 0
    const percentage  = Math.min(100, Math.round((windowCount / limits.window) * 100))
    const oldest  = windowMsgs?.[0]
    const resetAt = oldest
      ? new Date(new Date(oldest.created_at).getTime() + 3 * 60 * 60 * 1000)
      : new Date(now.getTime() + 3 * 60 * 60 * 1000)
    const resetTime = formatTime(resetAt)
    return { percentage, resetTime }
  } catch {
    return {}
  }
}

export async function askZyctra(messages) {
  const token  = config.get('token')
  const engine = config.get('engine') || 'vora'

  const { allowed, message } = await checkUsageLimits(token)
  if (!allowed) {
    console.log(chalk.red(`\n${message}`))
    console.log(chalk.gray('  Upgrade at zyctra.com/plans\n'))
    process.exit(1)
  }

  const spinner = ora({
    text: '',
    spinner: { frames: ['✦', '✧', '✦', '✧'], interval: 300 },
  }).start()

  let fullResponse = ''

  try {
    const stream = getClient().messages.stream({
      model:      MODEL_MAP[engine] ?? MODEL_MAP.vora,
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      messages,
    })

    spinner.stop()
    process.stdout.write(chalk.cyan('Zyctra: '))

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        process.stdout.write(chunk.delta.text)
        fullResponse += chunk.delta.text
      }
    }

    process.stdout.write('\n\n')

    const userId = config.get('userId') || getUserIdFromToken(token)
    await recordUsage(token, userId, engine)

    return fullResponse

  } catch (error) {
    spinner.stop()
    if (error.message?.includes('ANTHROPIC_API_KEY')) {
      console.log(chalk.red('\n✗ ANTHROPIC_API_KEY not set. Add it to your .env file.\n'))
    } else {
      console.log(chalk.red('\n✗ Error:', error.message, '\n'))
    }
    return null
  }
}
