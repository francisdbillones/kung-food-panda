import http from 'http'
import { HOST, PORT } from './config'
import { cleanupExpiredSessions, ensureSessionTable } from './services/sessionService'
import { routeRequest } from './router'

async function startServer() {
  await ensureSessionTable()
  await cleanupExpiredSessions()
  setInterval(cleanupExpiredSessions, 1000 * 60 * 30).unref()

  const server = http.createServer(routeRequest)
  server.listen(PORT, HOST, () => {
    console.log(`Kung Food Panda server running at http://${HOST}:${PORT}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})
