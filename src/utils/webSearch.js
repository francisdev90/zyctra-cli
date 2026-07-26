import fetch from 'node-fetch'

export async function searchWeb(query) {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'User-Agent': 'Zyctra/1.0 (https://zyctra.com)' } }
    )
    const data = await response.json()

    const results = []
    if (data.Abstract) results.push(`${data.Heading}: ${data.Abstract} (${data.AbstractURL})`)
    data.RelatedTopics?.slice(0, 3).forEach(t => {
      if (t.Text) results.push(t.Text)
    })

    return results.length > 0 ? results.join('\n\n') : null
  } catch {
    return null
  }
}
