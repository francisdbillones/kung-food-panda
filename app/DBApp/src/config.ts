import path from 'path'

export const PORT = Number(process.env.PORT) || 3000
export const HOST = process.env.HOST || '0.0.0.0'
export const FRONTEND_DIR = path.resolve(__dirname, '..', '..', '..', 'frontend')
export const SESSION_TABLE = 'user_sessions'
export const SESSION_COOKIE = process.env.SESSION_COOKIE || 'kfp_session'
export const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS) || 1000 * 60 * 60 * 8
export const ADMIN_ID = process.env.ADMIN_ID || 'ADMIN-001'
export const DAY_MS = 24 * 60 * 60 * 1000

export const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

export const ROLE_DEFAULT_ROUTES: Record<string, string> = {
  customer: '/customer-dashboard.html',
  farmer: '/farmer-console.html',
  admin: '/admin-console.html'
}

export const LOGIN_REDIRECT_PATHS = new Set(['/', '/login', '/login.html'])
