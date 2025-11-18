import { IncomingMessage, ServerResponse } from 'http'
import querystring from 'querystring'
import { SESSION_COOKIE } from '../config'

export type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null

export async function readBody<T = Record<string, any>>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 1e6) {
        reject(new Error('Payload too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({} as T)
        return
      }
      const raw = Buffer.concat(chunks).toString()
      const contentType = request.headers['content-type'] || ''
      try {
        if (contentType.includes('application/json')) {
          resolve(raw ? JSON.parse(raw) : {})
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          resolve(querystring.parse(raw) as T)
        } else {
          resolve({ raw } as T)
        }
      } catch (error) {
        reject(error)
      }
    })

    request.on('error', reject)
  })
}

export function sendJson(response: ServerResponse, statusCode: number, payload: Record<string, unknown>, extraHeaders: Record<string, string> = {}): void {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders
  })
  response.end(body)
}

export function parseCookies(header = ''): Record<string, string> {
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.trim().split('=')
    if (key) acc[key] = decodeURIComponent(value || '')
    return acc
  }, {})
}

export function buildSessionCookie(value: string, maxAge?: number): string {
  const segments = [
    `${SESSION_COOKIE}=${value}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax'
  ]
  if (maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, maxAge)}`)
  }
  if (process.env.COOKIE_SECURE === 'true') {
    segments.push('Secure')
  }
  return segments.join('; ')
}
