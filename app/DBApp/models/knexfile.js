const fs = require('fs')
const path = require('path')
const knexFactory = require('knex')

const databaseConfigPath = path.resolve(__dirname, '..', 'config', 'database.json')

function loadDatabaseConfig() {
  if (!fs.existsSync(databaseConfigPath)) {
    throw new Error(`Missing database config at ${databaseConfigPath}`)
  }
  const contents = fs.readFileSync(databaseConfigPath, 'utf-8')
  return JSON.parse(contents)
}

const fileConfig = loadDatabaseConfig()
const defaultConnection = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'kungfoodpanda_db'
}

const connection =
  process.env.DATABASE_URL ||
  fileConfig.url ||
  {
    ...defaultConnection,
    ...(fileConfig.connection || {})
  }

const knexConfig = {
  client: fileConfig.client || process.env.DB_CLIENT || 'mysql',
  connection,
  pool: fileConfig.pool || { min: 2, max: 10 }
}

const knex = knexFactory(knexConfig)

module.exports = knex
module.exports.knexConfig = knexConfig
