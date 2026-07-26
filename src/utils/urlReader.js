import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

export async function readUrl(url) {
  if (!url.startsWith('http')) url = 'https://' + url

  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Zyctra/1.0; +https://zyctra.com)',
      },
    })

    clearTimeout(timeout)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    const $    = cheerio.load(html)

    $('script, style, nav, footer, header, aside, iframe, noscript').remove()

    const title       = $('title').text().trim()
    const description = $('meta[name="description"]').attr('content') || ''
    const bodyText    = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000)

    return {
      url,
      title,
      description,
      content: `URL: ${url}\nTitle: ${title}\nDescription: ${description}\n\nContent:\n${bodyText}`,
    }
  } catch (error) {
    clearTimeout(timeout)
    if (error.name === 'AbortError') throw new Error('Request timed out after 10s')
    throw new Error(`Could not read URL: ${error.message}`)
  }
}

export function isUrl(str) {
  return /^(https?:\/\/|www\.)[^\s]+/.test(str) ||
    /^[a-zA-Z0-9-]+\.(com|org|net|io|dev|app|co|ai|me|uk|edu|gov)(\/[^\s]*)?$/.test(str)
}
