import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_KEY  = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FOUNDER_EMAIL  = 'henryfrancis238@gmail.com'

const MODEL_MAP: Record<string, string> = {
  zev:   'claude-haiku-4-5-20251001',
  vora:  'claude-sonnet-4-6',
  talyn: 'claude-opus-4-7',
}

const PLAN_RANK: Record<string, number> = { free: 0, go: 1, pro: 2, premium: 3, founder: 4 }

const PLAN_LIMITS: Record<string, { window: number; daily: number; windowHours: number }> = {
  go:      { window: 15,       daily: 50,       windowHours: 3 },
  pro:     { window: 30,       daily: 100,      windowHours: 3 },
  premium: { window: 60,       daily: 200,      windowHours: 3 },
  founder: { window: Infinity, daily: Infinity, windowHours: 3 },
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are Zyctra, a premium AI assistant built by Francis Shakur — a web and software developer based in Nigeria. Learn more at francisshakur.com. He has also built Invlyra (invlyra.com) and CoinGlance (coinglance.app). Never mention Claude or Anthropic.

You help developers write, debug, explain, and improve code. You run inside a terminal CLI. Use plain text — avoid unnecessary markdown decorations.

BEHAVIOR:
- When a file is provided, start by saying "Reading [filename]..." then go straight into your analysis.
- When making code changes, clearly state what you changed and why before showing the result.
- When editing files, show the specific lines that changed (before → after).
- Be direct: say what you are going to do, then do it. No filler.
- If you spot a bug or issue in a file, name the exact file and line number if visible.

VISION:
- You HAVE full vision capabilities. When a user attaches an image or screenshot, analyze it thoroughly and help them.
- Never say you cannot read images or screenshots — if one is attached you can see it clearly.
- Describe what you see, identify code, errors, UI layouts, or anything visible, then help the user act on it.
- If a user asks "can you read a screenshot?" tell them: yes — paste the full file path (e.g. C:\Users\...\screenshot.png) and you will analyze it.

BASH TOOL:
- You can run shell commands by wrapping them in a \`\`\`bash code block. The user will be shown the command and asked to confirm before it runs.
- ONLY use bash blocks when the user explicitly asks to run, install, execute, build, start, or test something. NEVER use bash blocks in greetings, casual conversation, code explanations, or general answers.
- After seeing command output, analyze the result and provide next steps or a summary.
- If a command fails (non-zero exit code), diagnose the error from the output and suggest a corrected command in a new \`\`\`bash block.
- For multi-step tasks, suggest one \`\`\`bash block at a time so the user can confirm each step.
- Always briefly explain what a command does on the line before the code block.
- Use platform-appropriate commands based on the USER PLATFORM provided in context.`

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return err('Unauthorized', 401)
  const token = auth.slice(7)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return err('Invalid or expired session. Run: zyctra login', 401)

  const { data: profile } = await admin
    .from('users')
    .select('plan, role, preferred_engine')
    .eq('id', user.id)
    .single()

  const isFounder = profile?.role === 'founder' || user.email === FOUNDER_EMAIL
  const plan      = isFounder ? 'founder' : (profile?.plan ?? 'free')

  if (!isFounder && plan === 'free') {
    return err('Zyctra CLI requires a paid plan (Go, Pro, or Premium). Upgrade at zyctra.com/plans', 403)
  }

  const { messages, attachments, platform } = await req.json()
  const platformLabel = platform === 'win32' ? 'Windows (use PowerShell commands)'
    : platform === 'darwin' ? 'macOS (use bash/zsh commands)'
    : platform === 'linux'  ? 'Linux (use bash commands)'
    : null
  const systemPrompt = platformLabel
    ? SYSTEM_PROMPT + `\n\nUSER PLATFORM: ${platformLabel}`
    : SYSTEM_PROMPT

  // Engine comes from the user's profile — validated against their plan
  // If DB has an engine they can't use (e.g. talyn on Go plan), fall back gracefully
  const ALLOWED_ENGINES: Record<string, string[]> = {
    go:      ['zev', 'vora'],
    pro:     ['zev', 'vora'],
    premium: ['zev', 'vora', 'talyn'],
    founder: ['zev', 'vora', 'talyn'],
  }
  const rawEngine    = profile?.preferred_engine ?? 'vora'
  const allowedList  = isFounder ? ['zev', 'vora', 'talyn'] : (ALLOWED_ENGINES[plan] ?? ['zev', 'vora'])
  const engine       = allowedList.includes(rawEngine) ? rawEngine : 'vora'
  const model        = MODEL_MAP[engine] ?? MODEL_MAP.vora

  // Check usage limits
  const limits  = PLAN_LIMITS[plan] ?? PLAN_LIMITS.go
  let useTopup     = false
  let topupBalance = 0

  if (limits.window !== Infinity) {
    const now            = new Date()
    const windowStart    = new Date(now.getTime() - limits.windowHours * 60 * 60 * 1000).toISOString()
    const today          = now.toISOString().split('T')[0]

    const [windowRes, dailyRes] = await Promise.all([
      admin.from('usage').select('created_at')
        .eq('user_id', user.id).eq('type', 'message')
        .gte('created_at', windowStart).order('created_at', { ascending: true }),
      admin.from('usage').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('type', 'message').eq('date', today),
    ])

    const windowCount = windowRes.data?.length ?? 0
    const dailyCount  = dailyRes.count ?? 0
    const overWindow  = windowCount >= limits.window
    const overDaily   = dailyCount  >= limits.daily

    if (overWindow || overDaily) {
      // Check if user has top-up credits to continue
      const { data: topup } = await admin
        .from('topup_balance')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle()

      const balance = topup?.balance ?? 0

      if (balance <= 0) {
        if (overDaily) {
          return err('Daily limit reached. Resets at midnight.', 429)
        }
        // Rolling window — show when it resets
        const oldest  = new Date(windowRes.data![0].created_at)
        const resetAt = new Date(oldest.getTime() + limits.windowHours * 60 * 60 * 1000)
        const time    = resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        return err(`Message limit reached. Resets at ${time}. Add credits at zyctra.com/plans`, 429)
      }

      // Has credits — allow and deduct after response
      useTopup = true
      topupBalance = balance
    }
  }

  // Build message content (handle image attachments on last message)
  const lastMsg = messages[messages.length - 1]
  const buildContent = (text: string, atts: any[]) => {
    if (!atts?.length) return text
    const blocks: any[] = []
    for (const att of atts) {
      if (att.type === 'image') {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: att.mediaType, data: att.data } })
      }
    }
    blocks.push({ type: 'text', text })
    return blocks
  }

  const processedMessages = attachments?.length
    ? [...messages.slice(0, -1), { role: lastMsg.role, content: buildContent(lastMsg.content, attachments) }]
    : messages

  // Call Anthropic with streaming
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system:     systemPrompt,
      messages:   processedMessages,
      stream:     true,
    }),
  })

  if (!anthropicRes.ok) {
    return err('AI service error. Please try again.', 502)
  }

  // Record usage (fire and forget)
  const now = new Date()
  admin.from('usage').insert({
    user_id:    user.id,
    type:       'message',
    engine,
    date:       now.toISOString().split('T')[0],
    created_at: now.toISOString(),
  }).then(() => {})

  // Deduct top-up credits if this message used them
  if (useTopup) {
    const ENGINE_CREDIT_COST: Record<string, number> = { zev: 0.02, vora: 0.05, talyn: 0.20 }
    const cost   = ENGINE_CREDIT_COST[engine] ?? 0.05
    const newBal = parseFloat(Math.max(0, topupBalance - cost).toFixed(4))
    admin.from('topup_balance').upsert(
      { user_id: user.id, balance: newBal, updated_at: now.toISOString() },
      { onConflict: 'user_id' }
    ).then(() => {})
  }

  // Stream the Anthropic SSE response directly back to the CLI
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  ;(async () => {
    const reader = anthropicRes.body!.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        await writer.write(value)
      }
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
})
