import fs from 'fs'
import path from 'path'

const TEXT_EXTS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.json', '.md', '.txt',
  '.py', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.rs', '.sql',
  '.yaml', '.yml', '.xml', '.sh', '.env', '.gitignore',
])

const IMAGE_EXTS = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
}

export async function readFile(filePath) {
  const fullPath = path.resolve(filePath)
  const ext      = path.extname(filePath).toLowerCase()

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const stats = fs.statSync(fullPath)
  if (stats.size > 5 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 5 MB.')
  }

  if (TEXT_EXTS.has(ext)) {
    const content = fs.readFileSync(fullPath, 'utf-8')
    return {
      type:        'text',
      name:        path.basename(filePath),
      content,
      textContent: `File: ${path.basename(filePath)}\n\`\`\`${ext.slice(1)}\n${content}\n\`\`\``,
    }
  }

  if (IMAGE_EXTS[ext]) {
    const data = fs.readFileSync(fullPath).toString('base64')
    return {
      type:      'image',
      name:      path.basename(filePath),
      data,
      mediaType: IMAGE_EXTS[ext],
    }
  }

  if (ext === '.pdf') {
    const pdfParse  = await import('pdf-parse/lib/pdf-parse.js')
    const dataBuffer = fs.readFileSync(fullPath)
    const pdfData   = await pdfParse.default(dataBuffer)
    return {
      type:        'text',
      name:        path.basename(filePath),
      content:     pdfData.text,
      textContent: `File: ${path.basename(filePath)} (PDF)\n${pdfData.text}`,
    }
  }

  throw new Error(`Unsupported file type: ${ext}`)
}
