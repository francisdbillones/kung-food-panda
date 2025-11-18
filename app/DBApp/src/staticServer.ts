import { ServerResponse } from 'http'
import path from 'path'
import fs from 'fs/promises'
import { FRONTEND_DIR, MIME_TYPES } from './config'

export async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  let relativePath = pathname
  if (relativePath === '/' || !relativePath) {
    relativePath = '/login.html'
  }

  const normalizedPath = path.normalize(relativePath).replace(/^[/\\]+/, '')
  if (normalizedPath.includes('..')) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' })
    response.end('Forbidden')
    return
  }
  const safePath = normalizedPath
  const fullPath = path.join(FRONTEND_DIR, safePath)

  try {
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      await serveStatic(path.join(relativePath, 'index.html'), response)
      return
    }
    const ext = path.extname(fullPath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const data = await fs.readFile(fullPath)
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length
    })
    response.end(data)
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' })
      response.end('Not found')
    } else {
      console.error('Static file error', error)
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' })
      response.end('Server error')
    }
  }
}
