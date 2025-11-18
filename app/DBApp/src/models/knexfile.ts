import fs from 'fs'
import path from 'path'
import knex, { Knex } from 'knex'

const databaseConfigPath = path.resolve(__dirname, '..', '..', 'config', 'database.json')

interface DatabaseFileConfig {
  client?: string
  url?: string
  connection?: Knex.MySqlConnectionConfig
  pool?: Knex.PoolConfig
}

function loadDatabaseConfig(): DatabaseFileConfig {
  if (!fs.existsSync(databaseConfigPath)) {
    throw new Error(`Missing database config at ${databaseConfigPath}`)
  }
  const contents = fs.readFileSync(databaseConfigPath, 'utf-8')
  return JSON.parse(contents)
}

const fileConfig = loadDatabaseConfig()

const defaultConnection: Knex.MySqlConnectionConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'kungfoodpanda_db'
}

const resolvedConnection: string | Knex.MySqlConnectionConfig =
  process.env.DATABASE_URL ||
  fileConfig.url ||
  {
    ...defaultConnection,
    ...(fileConfig.connection || {})
  }

export const knexConfig: Knex.Config = {
  client: fileConfig.client || process.env.DB_CLIENT || 'mysql',
  connection: resolvedConnection,
  pool: fileConfig.pool || { min: 2, max: 10 }
}

const knexInstance = knex(knexConfig)

export default knexInstance
