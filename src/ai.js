import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import ora from 'ora'
import { config } from './config.js'

const SUPABASE_URL   = 'https://ewqcetzyzjhdzbyxphla.supabase.co'
const SUPABASE_KEY   = 'sb_publishable_PcVlEjFAHPGvNqTo3jZieg_jTTv0sSc'
const CHAT_ENDPOINT  = `${SUPABASE_URL}/functions/v1/chat`

const PLAN_LIMITS = {
  go:      { window: 15,       daily: 50,       windowHours: 3 },
  pro:     { window: 30,       daily: 100,      windowHours: 3 },
  premium: { window: 60,       daily: 200,      windowHours: 3 },
  founder: { window: Infinity, daily: Infinity, windowHours: 3 },
}

function getSupabase(token) {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

function getUserIdFromToken(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub
  } catch {
    return null
  }
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export async function getUsageStats(token) {
  if (!token || config.get('isFounder')) return {}
  try {
    const supabase  = getSupabase(token)
    const userId    = config.get('userId') || getUserIdFromToken(token)
    if (!userId) return {}
    const plan      = config.get('plan') || 'go'
    const limits    = PLAN_LIMITS[plan] ?? PLAN_LIMITS.go
    if (limits.window === Infinity) return {}
    const now           = new Date()
    const threeHoursAgo = new Date(now - limits.windowHours * 60 * 60 * 1000).toISOString()
    const { data: windowMsgs } = await supabase
      .from('usage').select('created_at')
      .eq('user_id', userId).eq('type', 'message')
      .gte('created_at', threeHoursAgo).order('created_at', { ascending: true })
    const windowCount  = windowMsgs?.length ?? 0
    const percentage   = Math.min(100, Math.round((windowCount / limits.window) * 100))
    const oldest       = windowMsgs?.[0]
    const resetAt      = oldest
      ? new Date(new Date(oldest.created_at).getTime() + 3 * 60 * 60 * 1000)
      : new Date(now.getTime() + 3 * 60 * 60 * 1000)
    return { percentage, resetTime: formatTime(resetAt) }
  } catch {
    return {}
  }
}

export async function askZyctraAndReturn(messages, _engine, attachments = []) {
  return askZyctra(messages, _engine, attachments, { silent: true })
}

export async function askZyctra(messages, _engine, attachments = [], options = {}) {
  const token = config.get('token')
  if (!token) {
    console.log(chalk.red('\n✗ Please login first: zyctra login\n'))
    process.exit(1)
  }

  const spinner = ora({
    text: '',
    spinner: { frames: ['✦', '✧', '✦', '✧'], interval: 300 },
  }).start()

  let fullResponse = ''

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ messages, attachments }),
    })

    spinner.stop()

    if (!res.ok) {
      let errMsg = 'Unknown error'
      try { errMsg = (await res.json()).error ?? errMsg } catch {}
      if (res.status === 401) {
        console.log(chalk.red('\n✗ Session expired. Run: zyctra login\n'))
        process.exit(1)
      } else if (res.status === 403) {
        console.log(chalk.red(`\n✗ ${errMsg}`))
        console.log(chalk.gray('  Upgrade at zyctra.com/plans\n'))
        process.exit(1)
      } else if (res.status === 429) {
        console.log(chalk.yellow(`\n⚠  ${errMsg}\n`))
        process.exit(1)
      } else {
        console.log(chalk.red(`\n✗ ${errMsg}\n`))
      }
      return null
    }

    const engine      = config.get('engine') || 'vora'
    const engineLabel = { zev: 'Zev', vora: 'Vora', talyn: 'Talyn' }[engine] || 'Zyctra'

    if (!options.silent) process.stdout.write(chalk.cyan(`${engineLabel} · `))

    // Parse Anthropic SSE stream
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer    = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            if (!options.silent) process.stdout.write(parsed.delta.text)
            fullResponse += parsed.delta.text
          }
        } catch {}
      }
    }

    if (!options.silent) process.stdout.write('\n\n')
    return fullResponse

  } catch (error) {
    spinner.stop()
    console.log(chalk.red('\n✗ Connection error:', error.message))
    console.log(chalk.gray('  Check your internet connection and try again.\n'))
    return null
  }
}
