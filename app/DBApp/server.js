const http = require('http')
const path = require('path')
const fs = require('fs/promises')
const { URL } = require('url')
const querystring = require('querystring')
const crypto = require('crypto')

const knex = require('./models/knexfile')

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'
const FRONTEND_DIR = path.resolve(__dirname, '..', '..', 'frontend')
const SESSION_TABLE = 'user_sessions'
const SESSION_COOKIE = process.env.SESSION_COOKIE || 'kfp_session'
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8, 10)
const ADMIN_ID = process.env.ADMIN_ID || 'ADMIN-001'
const DAY_MS = 24 * 60 * 60 * 1000

const MIME_TYPES = {
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

const ADMIN_ENTITIES = {
  clients: {
    label: 'Clients',
    table: 'Client',
    primaryKey: ['client_id'],
    autoIncrement: false,
    fields: [
      { column: 'client_id', label: 'Client ID', type: 'number' },
      { column: 'company_name', label: 'Company Name', type: 'text' },
      { column: 'first_name', label: 'First Name', type: 'text' },
      { column: 'last_name', label: 'Last Name', type: 'text' },
      { column: 'honorific', label: 'Honorific', type: 'text' },
      { column: 'email', label: 'Email', type: 'text' },
      { column: 'location_id', label: 'Location ID', type: 'number' },
      { column: 'loyalty_points', label: 'Loyalty Points', type: 'number' }
    ],
    defaultSort: ['client_id', 'asc']
  },
  farms: {
    label: 'Farms',
    table: 'Farm',
    primaryKey: ['farm_id'],
    autoIncrement: false,
    fields: [
      { column: 'farm_id', label: 'Farm ID', type: 'number' },
      { column: 'location_id', label: 'Location ID', type: 'number' }
    ],
    defaultSort: ['farm_id', 'asc']
  },
  locations: {
    label: 'Locations',
    table: 'Location',
    primaryKey: ['location_id'],
    autoIncrement: false,
    fields: [
      { column: 'location_id', label: 'Location ID', type: 'number' },
      { column: 'continent', label: 'Continent', type: 'text' },
      { column: 'country', label: 'Country', type: 'text' },
      { column: 'state', label: 'State', type: 'text' },
      { column: 'city', label: 'City', type: 'text' },
      { column: 'street', label: 'Street', type: 'text' }
    ],
    defaultSort: ['location_id', 'asc']
  },
  products: {
    label: 'Raw Products',
    table: 'RawProduct',
    primaryKey: ['product_id'],
    autoIncrement: false,
    fields: [
      { column: 'product_id', label: 'Product ID', type: 'number' },
      { column: 'product_name', label: 'Product Name', type: 'text' },
      { column: 'product_type', label: 'Type', type: 'text' },
      { column: 'grade', label: 'Grade', type: 'text' },
      { column: 'start_season', label: 'Season Start', type: 'date' },
      { column: 'end_season', label: 'Season End', type: 'date' }
    ],
    defaultSort: ['product_id', 'asc']
  },
  inventory: {
    label: 'Inventory',
    table: 'Inventory',
    primaryKey: ['batch_id'],
    autoIncrement: true,
    fields: [
      { column: 'batch_id', label: 'Batch ID', type: 'number', readOnly: true },
      { column: 'product_id', label: 'Product ID', type: 'number' },
      { column: 'farm_id', label: 'Farm ID', type: 'number' },
      { column: 'price', label: 'Price', type: 'number' },
      { column: 'weight', label: 'Weight', type: 'number' },
      { column: 'notes', label: 'Notes', type: 'text' },
      { column: 'exp_date', label: 'Expiration Date', type: 'date' },
      { column: 'quantity', label: 'Quantity', type: 'number' }
    ],
    defaultSort: ['batch_id', 'desc']
  },
  orders: {
    label: 'Orders',
    table: 'Orders',
    primaryKey: ['order_id'],
    autoIncrement: true,
    fields: [
      { column: 'order_id', label: 'Order ID', type: 'number', readOnly: true },
      { column: 'client_id', label: 'Client ID', type: 'number' },
      { column: 'batch_id', label: 'Batch ID', type: 'number' },
      { column: 'location_id', label: 'Location ID', type: 'number' },
      { column: 'order_date', label: 'Order Date', type: 'date' },
      { column: 'quantity', label: 'Quantity', type: 'number' },
      { column: 'is_shipped', label: 'Is Shipped (0/1)', type: 'number' },
      { column: 'due_by', label: 'Due By', type: 'date' },
      { column: 'loyalty_points_used', label: 'Loyalty Points Used', type: 'number' },
      { column: 'program_id', label: 'Program ID', type: 'number' }
    ],
    defaultSort: ['order_id', 'desc']
  },
  subscriptions: {
    label: 'Subscriptions',
    table: 'Subscription',
    primaryKey: ['program_id'],
    autoIncrement: true,
    fields: [
      { column: 'program_id', label: 'Program ID', type: 'number', readOnly: true },
      { column: 'product_id', label: 'Product ID', type: 'number' },
      { column: 'farm_id', label: 'Farm ID', type: 'number' },
      { column: 'client_id', label: 'Client ID', type: 'number' },
      { column: 'order_interval_days', label: 'Interval (days)', type: 'number' },
      { column: 'start_date', label: 'Start Date', type: 'date' },
      { column: 'quantity', label: 'Quantity', type: 'number' },
      { column: 'location_id', label: 'Location ID', type: 'number' },
      { column: 'price', label: 'Price', type: 'number' },
      { column: 'status', label: 'Status', type: 'text' }
    ],
    defaultSort: ['program_id', 'desc']
  },
  farmproducts: {
    label: 'Farm Products',
    table: 'FarmProduct',
    primaryKey: ['product_id', 'farm_id'],
    autoIncrement: false,
    fields: [
      { column: 'product_id', label: 'Product ID', type: 'number' },
      { column: 'farm_id', label: 'Farm ID', type: 'number' },
      { column: 'population', label: 'Population', type: 'number' }
    ],
    defaultSort: ['product_id', 'asc']
  }
}

function normalizeAdminEntityKey(name) {
  return String(name || '').trim().toLowerCase()
}

function getAdminEntityConfig(name) {
  const key = normalizeAdminEntityKey(name)
  const config = ADMIN_ENTITIES[key]
  if (!config) {
    const error = new Error('Unknown admin entity.')
    error.statusCode = 400
    throw error
  }
  return { key, ...config }
}

function adminMetadataSnapshot() {
  return Object.entries(ADMIN_ENTITIES).reduce((acc, [key, config]) => {
    acc[key] = {
      label: config.label,
      primaryKey: config.primaryKey,
      autoIncrement: config.autoIncrement,
      fields: config.fields
    }
    return acc
  }, {})
}

async function fetchAdminEntityRows(config) {
  let query = knex(config.table).select(projectAdminFields(config))
  if (config.defaultSort) {
    query = query.orderBy(config.defaultSort[0], config.defaultSort[1] || 'asc')
  }
  return query.limit(250)
}

async function ensurePrimaryKeysPresent(config, values) {
  const pkValues = {}
  const missing = []
  config.primaryKey.forEach((column) => {
    if (values[column] == null) {
      missing.push(column)
    } else {
      pkValues[column] = values[column]
    }
  })
  if (config.autoIncrement) {
    return pkValues
  }
  if (missing.length === 0) {
    return pkValues
  }
  if (missing.length === 1 && config.primaryKey.length === 1) {
    const generated = await generateAdminPrimaryKey(config)
    values[missing[0]] = generated
    pkValues[missing[0]] = generated
    return pkValues
  }
  throw httpError(400, 'Primary key values are required for this entity.')
}

function projectAdminFields(config) {
  return config.fields.map((field) => field.column)
}

function getAdminField(config, column) {
  return config.fields.find((field) => field.column === column)
}

function coerceAdminValue(field, raw) {
  if (raw === undefined) return undefined
  if (raw === null) return null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') {
      return null
    }
    raw = trimmed
  }
  if (field?.type === 'number') {
    const num = Number(raw)
    if (Number.isNaN(num)) {
      throw httpError(400, `Field ${field.column} expects a numeric value.`)
    }
    return num
  }
  if (field?.type === 'date') {
    const date = raw instanceof Date ? raw : new Date(raw)
    if (Number.isNaN(date.getTime())) {
      throw httpError(400, `Field ${field.column} expects a valid date.`)
    }
    return date.toISOString().split('T')[0]
  }
  return raw
}

function sanitizeAdminPayload(config, payload, { includePrimaryKeys = true } = {}) {
  const output = {}
  config.fields.forEach((field) => {
    if (!includePrimaryKeys && config.primaryKey.includes(field.column)) {
      return
    }
    if (!Object.prototype.hasOwnProperty.call(payload, field.column)) {
      return
    }
    const value = coerceAdminValue(field, payload[field.column])
    if (value !== undefined) {
      output[field.column] = value
    }
  })
  return output
}

function parseAdminIdentifier(config, rawId) {
  if (!rawId) {
    throw httpError(400, 'Record identifier is required.')
  }
  const { primaryKey } = config
  if (primaryKey.length === 1) {
    const field = getAdminField(config, primaryKey[0])
    return { [primaryKey[0]]: coerceAdminValue(field, rawId) }
  }
  const rawParts = String(rawId).split(':')
  if (rawParts.length !== primaryKey.length) {
    throw httpError(400, `Identifier must include ${primaryKey.length} segments separated by ':'`)
  }
  return primaryKey.reduce((acc, column, index) => {
    const field = getAdminField(config, column)
    acc[column] = coerceAdminValue(field, rawParts[index])
    return acc
  }, {})
}

async function generateAdminPrimaryKey(config) {
  if (config.autoIncrement || config.primaryKey.length !== 1) {
    return null
  }
  const column = config.primaryKey[0]
  const maxRow = await knex(config.table).max({ maxId: column }).first()
  return (maxRow?.maxId || 0) + 1
}

async function ensureSessionTable() {
  const exists = await knex.schema.hasTable(SESSION_TABLE)
  if (!exists) {
    await knex.schema.createTable(SESSION_TABLE, (table) => {
      table.string('token', 64).primary()
      table.string('user_type', 20).notNullable()
      table.string('user_identifier', 191).notNullable()
      table.text('session_data').notNullable()
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('expires_at').notNullable()
    })
  }
}

async function cleanupExpiredSessions() {
  const now = new Date()
  try {
    await knex(SESSION_TABLE).where('expires_at', '<', now).delete()
  } catch (error) {
    console.error('Failed to clean sessions', error)
  }
}

function parseCookies(header = '') {
  return header.split(';').reduce((acc, part) => {
    const [key, value] = part.trim().split('=')
    if (key) acc[key] = decodeURIComponent(value || '')
    return acc
  }, {})
}

function toISODate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().split('T')[0]
}

function computeNextDeliveryDate(startDate, intervalDays) {
  if (!startDate || !intervalDays) return null
  const start = startDate instanceof Date ? startDate : new Date(startDate)
  if (Number.isNaN(start.getTime())) return null
  if (intervalDays <= 0) return start
  const now = new Date()
  if (start > now) return start
  const elapsedMs = now.getTime() - start.getTime()
  const intervalsElapsed = Math.floor(elapsedMs / (intervalDays * DAY_MS)) + 1
  return new Date(start.getTime() + intervalsElapsed * intervalDays * DAY_MS)
}

function buildCookie(value, maxAge) {
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

async function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
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
        resolve({})
        return
      }
      const raw = Buffer.concat(chunks).toString()
      const contentType = request.headers['content-type'] || ''
      try {
        if (contentType.includes('application/json')) {
          resolve(raw ? JSON.parse(raw) : {})
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          resolve(querystring.parse(raw))
        } else {
          resolve({ raw })
        }
      } catch (error) {
        reject(error)
      }
    })

    request.on('error', reject)
  })
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders
  })
  response.end(body)
}

async function createSessionRecord(userType, identifier, sessionData) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await knex(SESSION_TABLE).insert({
    token,
    user_type: userType,
    user_identifier: identifier,
    session_data: JSON.stringify(sessionData),
    expires_at: expiresAt
  })
  return { token, expiresAt }
}

async function fetchSession(token) {
  if (!token) return null
  const record = await knex(SESSION_TABLE).where('token', token).first()
  if (!record) return null
  const expires = new Date(record.expires_at)
  if (expires < new Date()) {
    await knex(SESSION_TABLE).where('token', token).delete()
    return null
  }
  return {
    token: record.token,
    data: JSON.parse(record.session_data),
    expiresAt: expires
  }
}

async function deleteSession(token) {
  if (!token) return
  await knex(SESSION_TABLE).where('token', token).delete()
}

async function getSessionFromRequest(request) {
  const cookies = parseCookies(request.headers.cookie)
  return fetchSession(cookies[SESSION_COOKIE])
}

async function requireSession(request, response, role) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    sendJson(response, 401, { error: 'Authentication required.' })
    return null
  }
  if (role && session.data.role !== role) {
    sendJson(response, 403, { error: 'Forbidden.' })
    return null
  }
  return session
}

function mapOrderRow(row) {
  const quantity = Number(row.quantity) || 0
  const unitPrice = row.unit_price == null ? null : Number(row.unit_price)
  const loyaltyDiscount = Number(row.loyalty_points_used) || 0
  const grossAmount = unitPrice == null ? null : Number((unitPrice * quantity).toFixed(2))
  const totalAmount = grossAmount == null
    ? null
    : Number(Math.max(0, grossAmount - loyaltyDiscount).toFixed(2))
  return {
    orderId: row.order_id,
    productName: row.product_name || `Batch #${row.order_id}`,
    quantity,
    unitPrice,
    loyaltyDiscount,
    grossAmount,
    totalAmount,
    orderDate: toISODate(row.order_date),
    dueBy: toISODate(row.due_by),
    status: row.is_shipped ? 'Shipped' : 'Pending fulfillment',
    statusVariant: row.is_shipped ? 'success' : 'pending'
  }
}

function mapSubscriptionRow(row) {
  const intervalDays = Number(row.order_interval_days) || null
  const nextDelivery = computeNextDeliveryDate(row.start_date, intervalDays)
  const locationParts = [row.city, row.state, row.country].filter(Boolean)
  return {
    programId: row.program_id,
    productId: row.product_id,
    farmId: row.farm_id || null,
    productName: row.product_name || `Product #${row.product_id}`,
    quantity: Number(row.quantity) || 0,
    intervalDays,
    startDate: toISODate(row.start_date),
    nextDeliveryDate: nextDelivery ? toISODate(nextDelivery) : null,
    locationLabel: locationParts.join(', ') || null,
    price: row.price != null ? Number(row.price) : null,
    status: row.status || 'AWAITING_QUOTE'
  }
}

function mapProductRow(row) {
  return {
    productId: row.product_id,
    productName: row.product_name,
    productType: row.product_type,
    grade: row.grade,
    farmCount: Number(row.farm_count) || 0,
    seasonStart: toISODate(row.start_season),
    seasonEnd: toISODate(row.end_season)
  }
}

function mapInventoryRow(row) {
  return {
    batchId: row.batch_id,
    productId: row.product_id,
    farmId: row.farm_id,
    price: Number(row.price),
    weight: row.weight != null ? Number(row.weight) : null,
    notes: row.notes,
    expDate: toISODate(row.exp_date),
    quantity: Number(row.quantity) || 0,
    productName: row.product_name,
    productType: row.product_type,
    productGrade: row.grade,
    seasonStart: toISODate(row.start_season),
    seasonEnd: toISODate(row.end_season),
    farmLocation: [row.city, row.state, row.country].filter(Boolean).join(', ') || 'Location TBD'
  }
}

function mapProductDetail(row) {
  if (!row) return null
  return {
    productId: row.product_id,
    productName: row.product_name,
    productType: row.product_type,
    grade: row.grade,
    seasonStart: toISODate(row.start_season),
    seasonEnd: toISODate(row.end_season),
    description: row.product_type ? `${row.product_type} · Grade ${row.grade}` : null
  }
}

function formatLocationLabel(record) {
  if (!record) return null
  const parts = [record.street, record.city, record.state, record.country].filter(Boolean)
  return parts.join(', ')
}

function mapLocationRow(row) {
  if (!row) return null
  return {
    locationId: row.location_id,
    continent: row.continent,
    country: row.country,
    state: row.state,
    city: row.city,
    street: row.street,
    label: formatLocationLabel(row)
  }
}

function buildSubscriptionQuery(clientId) {
  return knex('Subscription as s')
    .leftJoin('RawProduct as rp', 's.product_id', 'rp.product_id')
    .leftJoin('Location as loc', 's.location_id', 'loc.location_id')
    .select(
      's.program_id',
      's.product_id',
      's.farm_id',
      's.start_date',
      's.order_interval_days',
      's.quantity',
      's.price',
      's.status',
      'rp.product_name',
      'loc.city',
      'loc.state',
      'loc.country'
    )
    .where('s.client_id', clientId)
    .orderBy('s.program_id', 'asc')
}

function availableProductsQuery() {
  return knex('RawProduct as rp')
    .leftJoin('FarmProduct as fp', 'rp.product_id', 'fp.product_id')
    .select(
      'rp.product_id',
      'rp.product_name',
      'rp.product_type',
      'rp.grade',
      'rp.start_season',
      'rp.end_season'
    )
    .countDistinct({ farm_count: 'fp.farm_id' })
    .groupBy('rp.product_id', 'rp.product_name', 'rp.product_type', 'rp.grade', 'rp.start_season', 'rp.end_season')
    .orderBy('rp.product_name', 'asc')
}

function farmOffersQuery(productId) {
  return knex('FarmProduct as fp')
    .leftJoin('Farm as f', 'fp.farm_id', 'f.farm_id')
    .leftJoin('Location as loc', 'f.location_id', 'loc.location_id')
    .leftJoin('Inventory as inv', function joinInv() {
      this.on('inv.product_id', '=', 'fp.product_id').andOn('inv.farm_id', '=', 'fp.farm_id')
    })
    .select(
      'fp.farm_id',
      'loc.city',
      'loc.state',
      'loc.country'
    )
    .min({ min_price: 'inv.price' })
    .max({ max_price: 'inv.price' })
    .avg({ avg_price: 'inv.price' })
    .sum({ total_quantity: 'inv.quantity' })
    .count({ batch_count: 'inv.batch_id' })
    .where('fp.product_id', productId)
    .groupBy('fp.farm_id', 'loc.city', 'loc.state', 'loc.country')
    .orderBy('fp.farm_id', 'asc')
}

function mapFarmOffer(row) {
  const locationLabel = [row.city, row.state, row.country].filter(Boolean).join(', ') || 'Location TBD'
  return {
    farmId: row.farm_id,
    locationLabel,
    batchCount: Number(row.batch_count) || 0,
    totalQuantity: Number(row.total_quantity) || 0,
    minPrice: row.min_price != null ? Number(row.min_price) : null,
    maxPrice: row.max_price != null ? Number(row.max_price) : null,
    avgPrice: row.avg_price != null ? Number(row.avg_price) : null,
    standardSchedules: [7, 14, 30]
  }
}

async function createLocationRecord(locationPayload) {
  const continent = locationPayload.continent || 'Asia'
  const country = locationPayload.country || 'Philippines'
  const state = locationPayload.state || null
  const city = locationPayload.city
  const street = locationPayload.street
  if (!city || !street) {
    const error = new Error('Location requires city and street.')
    error.statusCode = 400
    throw error
  }
  const maxRow = await knex('Location').max('location_id as maxId').first()
  const newId = (maxRow?.maxId || 0) + 1
  await knex('Location').insert({
    location_id: newId,
    continent,
    country,
    state,
    city,
    street
  })
  return newId
}

async function getFarmRecord(farmId) {
  return knex('Farm as f')
    .leftJoin('Location as loc', 'f.location_id', 'loc.location_id')
    .select(
      'f.farm_id',
      'f.location_id',
      'loc.street',
      'loc.city',
      'loc.state',
      'loc.country'
    )
    .where('f.farm_id', farmId)
    .first()
}

function mapFarmRow(row) {
  if (!row) return null
  return {
    farmId: row.farm_id,
    locationId: row.location_id,
    locationLabel: formatLocationLabel(row),
    city: row.city,
    state: row.state,
    country: row.country,
    street: row.street
  }
}

function inventoryDetailQuery() {
  return knex('Inventory as inv')
    .leftJoin('RawProduct as rp', 'inv.product_id', 'rp.product_id')
    .leftJoin('Farm as f', 'inv.farm_id', 'f.farm_id')
    .leftJoin('Location as loc', 'f.location_id', 'loc.location_id')
    .select(
      'inv.batch_id',
      'inv.product_id',
      'inv.farm_id',
      'inv.price',
      'inv.weight',
      'inv.notes',
      'inv.exp_date',
      'inv.quantity',
      'rp.product_name',
      'rp.product_type',
      'rp.grade',
      'rp.start_season',
      'rp.end_season',
      'loc.city',
      'loc.state',
      'loc.country'
    )
}

function farmerOrderDetailQuery() {
  return knex('Orders as o')
    .leftJoin('Inventory as inv', 'o.batch_id', 'inv.batch_id')
    .leftJoin('RawProduct as rp', 'inv.product_id', 'rp.product_id')
    .leftJoin('Client as c', 'o.client_id', 'c.client_id')
    .leftJoin('Location as loc', 'o.location_id', 'loc.location_id')
    .select(
      'o.order_id',
      'o.program_id',
      'o.batch_id',
      'o.order_date',
      'o.due_by',
      'o.quantity',
      'o.is_shipped',
      'c.client_id',
      'c.first_name as client_first_name',
      'c.last_name as client_last_name',
      'c.company_name',
      'inv.farm_id',
      'inv.product_id',
      'inv.price as unit_price',
      'inv.notes',
      'rp.product_name',
      'loc.street as ship_street',
      'loc.city as ship_city',
      'loc.state as ship_state',
      'loc.country as ship_country'
    )
}

function farmerSubscriptionDetailQuery() {
  return knex('Subscription as s')
    .leftJoin('RawProduct as rp', 's.product_id', 'rp.product_id')
    .leftJoin('Client as c', 's.client_id', 'c.client_id')
    .leftJoin('Location as loc', 's.location_id', 'loc.location_id')
    .select(
      's.program_id',
      's.product_id',
      's.farm_id',
      's.client_id',
      's.order_interval_days',
      's.start_date',
      's.quantity',
      's.status',
      's.price',
      'rp.product_name',
      'c.first_name as client_first_name',
      'c.last_name as client_last_name',
      'loc.street',
      'loc.city',
      'loc.state',
      'loc.country'
    )
}

async function fetchInventoryRow(batchId) {
  return inventoryDetailQuery().where('inv.batch_id', batchId).first()
}

async function fetchOrderRow(orderId) {
  return farmerOrderDetailQuery().where('o.order_id', orderId).first()
}

async function fetchFarmerSubscriptionRow(programId) {
  return farmerSubscriptionDetailQuery().where('s.program_id', programId).first()
}

function mapFarmerOrderRow(row) {
  const quantity = Number(row.quantity) || 0
  const unitPrice = row.unit_price != null ? Number(row.unit_price) : null
  const totalAmount = unitPrice != null ? Number((unitPrice * quantity).toFixed(2)) : null
  const nameParts = [row.client_first_name, row.client_last_name].filter(Boolean)
  const clientName = nameParts.join(' ').trim()
  const clientLabel = row.company_name
    ? `${row.company_name}${clientName ? ` (${clientName})` : ''}`
    : clientName || `Client #${row.client_id}`
  const shipTo = formatLocationLabel({
    street: row.ship_street,
    city: row.ship_city,
    state: row.ship_state,
    country: row.ship_country
  })
  return {
    orderId: row.order_id,
    programId: row.program_id,
    batchId: row.batch_id,
    productId: row.product_id,
    productName: row.product_name || `Batch #${row.batch_id}`,
    quantity,
    unitPrice,
    totalAmount,
    orderDate: toISODate(row.order_date),
    dueBy: toISODate(row.due_by),
    isShipped: Boolean(row.is_shipped),
    status: row.is_shipped ? 'Shipped' : 'Pending',
    clientLabel,
    shipTo,
    notes: row.notes || null
  }
}

function mapFarmerSubscriptionRow(row) {
  const nameParts = [row.client_first_name, row.client_last_name].filter(Boolean)
  const customerName = nameParts.join(' ').trim() || `Client #${row.client_id}`
  const intervalDays = row.order_interval_days != null ? Number(row.order_interval_days) : null
  const nextDelivery = computeNextDeliveryDate(row.start_date, intervalDays)
  return {
    programId: row.program_id,
    productId: row.product_id,
    farmId: row.farm_id,
    clientId: row.client_id,
    customerName,
    productName: row.product_name || `Product #${row.product_id}`,
    quantity: Number(row.quantity) || 0,
    intervalDays,
    startDate: toISODate(row.start_date),
    nextDeliveryDate: nextDelivery ? toISODate(nextDelivery) : null,
    price: row.price != null ? Number(row.price) : null,
    status: row.status,
    locationLabel: formatLocationLabel(row)
  }
}

function mapFarmOfferingRow(row) {
  return {
    productId: row.product_id,
    farmId: row.farm_id,
    productName: row.product_name,
    productType: row.product_type,
    grade: row.grade,
    population: Number(row.population) || 0
  }
}

function mapRawProductLite(row) {
  return {
    productId: row.product_id,
    productName: row.product_name,
    productType: row.product_type,
    grade: row.grade,
    seasonStart: toISODate(row.start_season),
    seasonEnd: toISODate(row.end_season)
  }
}

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

async function fetchFarmerDashboardData(farmId) {
  const farm = await getFarmRecord(farmId)
  if (!farm) {
    return null
  }

  const inventoryPromise = inventoryDetailQuery()
    .where('inv.farm_id', farmId)
    .orderBy('inv.exp_date', 'asc')

  const ordersPromise = farmerOrderDetailQuery()
    .where('inv.farm_id', farmId)
    .orderBy('o.due_by', 'asc')

  const subscriptionsPromise = farmerSubscriptionDetailQuery()
    .where('s.farm_id', farmId)
    .orderBy('s.program_id', 'desc')

  const offeringsPromise = knex('FarmProduct as fp')
    .leftJoin('RawProduct as rp', 'fp.product_id', 'rp.product_id')
    .select(
      'fp.product_id',
      'fp.farm_id',
      'fp.population',
      'rp.product_name',
      'rp.product_type',
      'rp.grade'
    )
    .where('fp.farm_id', farmId)
    .orderBy('rp.product_name', 'asc')

  const rawProductsPromise = knex('RawProduct')
    .select('product_id', 'product_name', 'product_type', 'grade', 'start_season', 'end_season')
    .orderBy('product_name', 'asc')

  const [inventoryRows, ordersRows, subscriptionRows, offeringsRows, rawProductRows] = await Promise.all([
    inventoryPromise,
    ordersPromise,
    subscriptionsPromise,
    offeringsPromise,
    rawProductsPromise
  ])

  const pendingOrders = ordersRows.filter((row) => !row.is_shipped)
  const fulfilledOrders = ordersRows.filter((row) => row.is_shipped).slice(0, 5)

  return {
    farm: mapFarmRow(farm),
    inventory: inventoryRows.map(mapInventoryRow),
    orders: {
      pending: pendingOrders.map(mapFarmerOrderRow),
      fulfilled: fulfilledOrders.map(mapFarmerOrderRow)
    },
    subscriptions: subscriptionRows.map(mapFarmerSubscriptionRow),
    offerings: {
      active: offeringsRows.map(mapFarmOfferingRow),
      availableProducts: rawProductRows.map(mapRawProductLite)
    }
  }
}

async function getClientRecord(clientId) {
  return knex('Client as c')
    .leftJoin('Location as loc', 'c.location_id', 'loc.location_id')
    .select(
      'c.client_id',
      'c.company_name',
      'c.first_name',
      'c.last_name',
      'c.honorific',
      'c.email',
      'c.loyalty_points',
      'c.location_id',
      'loc.street',
      'loc.city',
      'loc.state',
      'loc.country'
    )
    .where('c.client_id', clientId)
    .first()
}

async function fetchCustomerDashboardData(clientId) {
  const client = await getClientRecord(clientId)
  if (!client) {
    return null
  }

  const pendingOrdersPromise = knex('Orders as o')
    .leftJoin('Inventory as i', 'o.batch_id', 'i.batch_id')
    .leftJoin('RawProduct as rp', 'i.product_id', 'rp.product_id')
    .select(
      'o.order_id',
      'o.order_date',
      'o.due_by',
      'o.quantity',
      'o.is_shipped',
      'o.loyalty_points_used',
      'i.price as unit_price',
      'rp.product_name'
    )
    .where('o.client_id', clientId)
    .andWhere('o.is_shipped', 0)
    .orderBy('o.due_by', 'asc')
    .limit(5)

  const recentOrdersPromise = knex('Orders as o')
    .leftJoin('Inventory as i', 'o.batch_id', 'i.batch_id')
    .leftJoin('RawProduct as rp', 'i.product_id', 'rp.product_id')
    .select(
      'o.order_id',
      'o.order_date',
      'o.due_by',
      'o.quantity',
      'o.is_shipped',
      'o.loyalty_points_used',
      'i.price as unit_price',
      'rp.product_name'
    )
    .where('o.client_id', clientId)
    .orderBy('o.order_date', 'desc')
    .limit(6)

  const subscriptionsPromise = buildSubscriptionQuery(clientId)

  const [pendingOrdersRows, recentOrdersRows, subscriptionsRows] = await Promise.all([
    pendingOrdersPromise,
    recentOrdersPromise,
    subscriptionsPromise
  ])

  return {
    profile: {
      clientId: client.client_id,
      firstName: client.first_name,
      lastName: client.last_name,
      loyaltyPoints: Number(client.loyalty_points) || 0
    },
    pendingOrders: pendingOrdersRows.map(mapOrderRow),
    recentOrders: recentOrdersRows.map(mapOrderRow),
    subscriptions: subscriptionsRows.map(mapSubscriptionRow)
  }
}

async function handleCustomerLogin(request, response) {
  const body = await readBody(request)
  const { customerId } = body

  if (!customerId) {
    sendJson(response, 400, { error: 'Customer ID is required.' })
    return
  }

  const client = await knex('Client').where('client_id', customerId).first()
  if (!client) {
    sendJson(response, 401, { error: 'Unknown customer ID.' })
    return
  }

  const payload = {
    role: 'customer',
    customerId: client.client_id,
    firstName: client.first_name,
    lastName: client.last_name,
    loyaltyPoints: client.loyalty_points
  }

  const { token } = await createSessionRecord('customer', String(client.client_id), payload)
  sendJson(response, 200, { line: `Welcome back, ${client.first_name}!`, profile: payload }, {
    'Set-Cookie': buildCookie(token, Math.floor(SESSION_TTL_MS / 1000))
  })
}

async function handleFarmerLogin(request, response) {
  const body = await readBody(request)
  const { farmId } = body

  if (!farmId) {
    sendJson(response, 400, { error: 'Farm ID is required.' })
    return
  }

  const farm = await knex('Farm').where('farm_id', farmId).first()
  if (!farm) {
    sendJson(response, 401, { error: 'Unknown farm ID.' })
    return
  }

  const payload = {
    role: 'farmer',
    farmId: farm.farm_id,
    locationId: farm.location_id
  }

  const { token } = await createSessionRecord('farmer', String(farm.farm_id), payload)
  sendJson(response, 200, { line: 'Farmer authenticated.', profile: payload }, {
    'Set-Cookie': buildCookie(token, Math.floor(SESSION_TTL_MS / 1000))
  })
}

async function handleAdminLogin(request, response) {
  const body = await readBody(request)
  const { adminId } = body

  if (!adminId) {
    sendJson(response, 400, { error: 'Admin ID is required.' })
    return
  }

  if (adminId !== ADMIN_ID) {
    sendJson(response, 401, { error: 'Invalid admin ID.' })
    return
  }

  const payload = {
    role: 'admin',
    adminId
  }

  const { token } = await createSessionRecord('admin', adminId, payload)
  sendJson(response, 200, { line: 'Admin access granted.', profile: payload }, {
    'Set-Cookie': buildCookie(token, Math.floor(SESSION_TTL_MS / 1000))
  })
}

async function handleAdminOverview(request, response) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const entries = await Promise.all(Object.entries(ADMIN_ENTITIES).map(async ([key, config]) => {
      const rows = await fetchAdminEntityRows({ key, ...config })
      return [key, rows]
    }))
    const data = Object.fromEntries(entries)
    sendJson(response, 200, {
      line: 'Admin overview ready.',
      metadata: adminMetadataSnapshot(),
      data
    })
  } catch (error) {
    console.error('Admin overview error', error)
    sendJson(response, 500, { error: 'Unable to load admin data.' })
  }
}

async function handleAdminEntityCreate(request, response) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const body = await readBody(request)
    const config = getAdminEntityConfig(body.entity)
    const values = sanitizeAdminPayload(config, body.values || body)
    if (Object.keys(values).length === 0) {
      sendJson(response, 400, { error: 'Provide at least one field to insert.' })
      return
    }
    await ensurePrimaryKeysPresent(config, values)
    const insertResult = await knex(config.table).insert(values)
    let record = null
    if (config.primaryKey.length === 1) {
      const column = config.primaryKey[0]
      const identifier = config.autoIncrement
        ? (Array.isArray(insertResult) ? insertResult[0] : insertResult)
        : values[column]
      record = await knex(config.table).where(column, identifier).first()
    } else {
      const whereClause = {}
      config.primaryKey.forEach((column) => {
        whereClause[column] = values[column]
      })
      record = await knex(config.table).where(whereClause).first()
    }
    sendJson(response, 201, {
      line: 'Record created.',
      entity: config.key,
      record
    })
  } catch (error) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else {
      console.error('Admin entity create error', error)
      sendJson(response, 500, { error: 'Unable to create record.' })
    }
  }
}

async function handleAdminEntityUpdate(request, response, entityName, identifier) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const config = getAdminEntityConfig(entityName)
    const keyWhere = parseAdminIdentifier(config, identifier)
    const body = await readBody(request)
    const updates = sanitizeAdminPayload(config, body.values || body, { includePrimaryKeys: false })
    if (Object.keys(updates).length === 0) {
      sendJson(response, 400, { error: 'Provide at least one field to update.' })
      return
    }
    const affected = await knex(config.table).where(keyWhere).update(updates)
    if (!affected) {
      sendJson(response, 404, { error: 'Record not found.' })
      return
    }
    const record = await knex(config.table).where(keyWhere).first()
    sendJson(response, 200, {
      line: 'Record updated.',
      entity: config.key,
      record
    })
  } catch (error) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else {
      console.error('Admin entity update error', error)
      sendJson(response, 500, { error: 'Unable to update record.' })
    }
  }
}

async function handleAdminEntityDelete(request, response, entityName, identifier) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const config = getAdminEntityConfig(entityName)
    const keyWhere = parseAdminIdentifier(config, identifier)
    const affected = await knex(config.table).where(keyWhere).delete()
    if (!affected) {
      sendJson(response, 404, { error: 'Record not found.' })
      return
    }
    sendJson(response, 200, {
      line: 'Record deleted.',
      entity: config.key
    })
  } catch (error) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      sendJson(response, 409, { error: 'Record is referenced by other rows.' })
    } else {
      console.error('Admin entity delete error', error)
      sendJson(response, 500, { error: 'Unable to delete record.' })
    }
  }
}

async function handleSessionRead(request, response) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    sendJson(response, 401, { error: 'No active session.' })
    return
  }

  sendJson(response, 200, { line: 'Session active.', profile: session.data })
}

async function handleLogout(request, response) {
  const cookies = parseCookies(request.headers.cookie)
  const token = cookies[SESSION_COOKIE]
  if (token) {
    await deleteSession(token)
  }
  sendJson(response, 200, { line: 'Logged out.' }, {
    'Set-Cookie': buildCookie('', 0)
  })
}

async function handleCustomerDashboard(request, response) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = session.data.customerId
  try {
    const data = await fetchCustomerDashboardData(clientId)
    if (!data) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    sendJson(response, 200, {
      line: 'Dashboard data ready.',
      ...data
    })
  } catch (error) {
    console.error('Dashboard fetch error', error)
    sendJson(response, 500, { error: 'Unable to load dashboard data.' })
  }
}

async function handleCustomerSubscriptions(request, response) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = session.data.customerId
  try {
    const client = await getClientRecord(clientId)
    if (!client) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    const [subscriptionsRows, availableProductsRows] = await Promise.all([
      buildSubscriptionQuery(clientId),
      availableProductsQuery()
    ])
    sendJson(response, 200, {
      line: 'Subscription data ready.',
      profile: {
        clientId: client.client_id,
        firstName: client.first_name,
        lastName: client.last_name
      },
      location: {
        locationId: client.location_id,
        label: formatLocationLabel(client)
      },
      subscriptions: subscriptionsRows.map(mapSubscriptionRow),
      availableProducts: availableProductsRows.map(mapProductRow)
    })
  } catch (error) {
    console.error('Subscriptions fetch error', error)
    sendJson(response, 500, { error: 'Unable to load subscriptions.' })
  }
}

async function handleCreateSubscription(request, response) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = session.data.customerId
  try {
    const client = await getClientRecord(clientId)
    if (!client) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    const body = await readBody(request)
    const productId = Number(body.productId)
    const farmId = Number(body.farmId)
    const quantity = Number(body.quantity)
    const intervalDays = Number(body.intervalDays)
    const startDate = body.startDate ? new Date(body.startDate) : new Date()
    const locationId = body.locationId ? Number(body.locationId) : client.location_id
    const price = body.price != null ? Number(body.price) : null

    if (!productId || Number.isNaN(productId)) {
      sendJson(response, 400, { error: 'Product is required.' })
      return
    }
    if (!farmId || Number.isNaN(farmId)) {
      sendJson(response, 400, { error: 'Farm selection is required.' })
      return
    }
    if (!quantity || quantity <= 0) {
      sendJson(response, 400, { error: 'Quantity must be greater than zero.' })
      return
    }
    if (!intervalDays || intervalDays <= 0) {
      sendJson(response, 400, { error: 'Delivery frequency is required.' })
      return
    }
    if (!locationId) {
      sendJson(response, 400, { error: 'A delivery location is required.' })
      return
    }
    if (Number.isNaN(startDate.getTime())) {
      sendJson(response, 400, { error: 'Invalid start date.' })
      return
    }
    if (price != null && (Number.isNaN(price) || price < 0)) {
      sendJson(response, 400, { error: 'Price, if provided, must be zero or greater.' })
      return
    }
    const product = await knex('RawProduct').where('product_id', productId).first()
    if (!product) {
      sendJson(response, 404, { error: 'Selected product not found.' })
      return
    }
    const farmProduct = await knex('FarmProduct')
      .where({ product_id: productId, farm_id: farmId })
      .first()
    if (!farmProduct) {
      sendJson(response, 400, { error: 'Selected farm does not offer this product.' })
      return
    }

    let programId
    try {
      const insertResult = await knex('Subscription').insert({
        product_id: productId,
        farm_id: farmId,
        client_id: clientId,
        order_interval_days: intervalDays,
        start_date: startDate,
        quantity,
        location_id: locationId,
        price
      })
      programId = Array.isArray(insertResult) ? insertResult[0] : insertResult
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        sendJson(response, 409, { error: 'You are already subscribed to this product.' })
        return
      }
      throw error
    }

    const newSubscription = await knex('Subscription')
      .where({ program_id: programId })
      .first()
    const mapped = mapSubscriptionRow({
      ...newSubscription,
      product_name: product.product_name,
      city: client.city,
      state: client.state,
      country: client.country
    })
    sendJson(response, 201, { line: 'Subscription created.', subscription: mapped })
  } catch (error) {
    console.error('Create subscription error', error)
    sendJson(response, 500, { error: 'Unable to create subscription.' })
  }
}

async function handleProductOffers(request, response, searchParams) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const productId = Number(searchParams.get('productId'))
  if (!productId) {
    sendJson(response, 400, { error: 'productId is required.' })
    return
  }
  try {
    const client = await getClientRecord(session.data.customerId)
    const productRecord = await knex('RawProduct').where('product_id', productId).first()
    if (!productRecord) {
      sendJson(response, 404, { error: 'Product not found.' })
      return
    }
    const offers = await farmOffersQuery(productId)
    sendJson(response, 200, {
      line: 'Product offers ready.',
      product: mapProductDetail(productRecord),
      offers: offers.map(mapFarmOffer),
      defaultLocation: mapLocationRow(client)
    })
  } catch (error) {
    console.error('Product offers error', error)
    sendJson(response, 500, { error: 'Unable to load product offerings.' })
  }
}

async function handleCreateLocation(request, response) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  try {
    const body = await readBody(request)
    const newId = await createLocationRecord(body)
    const location = await knex('Location').where('location_id', newId).first()
    sendJson(response, 201, {
      line: 'Location saved.',
      location: mapLocationRow(location)
    })
  } catch (error) {
    console.error('Create location error', error)
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else {
      sendJson(response, 500, { error: 'Unable to save location.' })
    }
  }
}

async function handleAccountRead(request, response) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  try {
    const client = await getClientRecord(session.data.customerId)
    if (!client) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    sendJson(response, 200, {
      line: 'Account loaded.',
      profile: {
        clientId: client.client_id,
        companyName: client.company_name,
        firstName: client.first_name,
        lastName: client.last_name,
        honorific: client.honorific,
        email: client.email,
        loyaltyPoints: client.loyalty_points
      },
      location: mapLocationRow(client)
    })
  } catch (error) {
    console.error('Account read error', error)
    sendJson(response, 500, { error: 'Unable to load account.' })
  }
}

async function handleAccountUpdate(request, response) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = session.data.customerId
  try {
    const body = await readBody(request)
    const updates = {}
    const allowedFields = new Map([
      ['companyName', 'company_name'],
      ['firstName', 'first_name'],
      ['lastName', 'last_name'],
      ['honorific', 'honorific'],
      ['email', 'email']
    ])
    allowedFields.forEach((column, field) => {
      if (body[field] !== undefined) {
        updates[column] = body[field]
      }
    })

    let locationId = body.locationId ? Number(body.locationId) : null
    if (body.location && typeof body.location === 'object') {
      try {
        locationId = await createLocationRecord(body.location)
      } catch (error) {
        if (error.statusCode) {
          sendJson(response, error.statusCode, { error: error.message })
          return
        }
        throw error
      }
    }
    if (locationId) {
      updates.location_id = locationId
    }

    if (Object.keys(updates).length === 0) {
      sendJson(response, 400, { error: 'No account fields provided.' })
      return
    }

    const affected = await knex('Client').where('client_id', clientId).update(updates)
    if (!affected) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    const refreshed = await getClientRecord(clientId)
    sendJson(response, 200, {
      line: 'Account updated.',
      profile: {
        clientId: refreshed.client_id,
        companyName: refreshed.company_name,
        firstName: refreshed.first_name,
        lastName: refreshed.last_name,
        honorific: refreshed.honorific,
        email: refreshed.email,
        loyaltyPoints: refreshed.loyalty_points
      },
      location: mapLocationRow(refreshed)
    })
  } catch (error) {
    console.error('Account update error', error)
    sendJson(response, 500, { error: 'Unable to update account.' })
  }
}

async function handleOrderOptions(request, response) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  try {
    const client = await getClientRecord(session.data.customerId)
    if (!client) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    const inventoryRows = await knex('Inventory as inv')
      .leftJoin('RawProduct as rp', 'inv.product_id', 'rp.product_id')
      .leftJoin('Farm as f', 'inv.farm_id', 'f.farm_id')
      .leftJoin('Location as loc', 'f.location_id', 'loc.location_id')
      .select(
        'inv.batch_id',
        'inv.product_id',
        'inv.farm_id',
        'inv.price',
        'inv.weight',
        'inv.notes',
        'inv.exp_date',
        'inv.quantity',
        'rp.product_name',
        'rp.product_type',
        'rp.grade',
        'rp.start_season',
        'rp.end_season',
        'loc.city',
        'loc.state',
        'loc.country'
      )
      .where('inv.quantity', '>', 0)
      .orderBy('inv.exp_date', 'asc')

    sendJson(response, 200, {
      line: 'Order options ready.',
      profile: {
        loyaltyPoints: client.loyalty_points,
        email: client.email
      },
      location: mapLocationRow(client),
      inventory: inventoryRows.map(mapInventoryRow)
    })
  } catch (error) {
    console.error('Order options error', error)
    sendJson(response, 500, { error: 'Unable to load order options.' })
  }
}

async function handleOrderBatch(request, response, searchParams) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const batchId = Number(searchParams.get('batchId'))
  if (!batchId) {
    sendJson(response, 400, { error: 'batchId is required.' })
    return
  }
  try {
    const client = await getClientRecord(session.data.customerId)
    if (!client) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    const row = await knex('Inventory as inv')
      .leftJoin('RawProduct as rp', 'inv.product_id', 'rp.product_id')
      .leftJoin('Farm as f', 'inv.farm_id', 'f.farm_id')
      .leftJoin('Location as loc', 'f.location_id', 'loc.location_id')
      .select(
        'inv.batch_id',
        'inv.product_id',
        'inv.farm_id',
        'inv.price',
        'inv.weight',
        'inv.notes',
        'inv.exp_date',
        'inv.quantity',
        'rp.product_name',
        'rp.product_type',
        'rp.grade',
        'rp.start_season',
        'rp.end_season',
        'loc.city',
        'loc.state',
        'loc.country'
      )
      .where('inv.batch_id', batchId)
      .first()
    if (!row) {
      sendJson(response, 404, { error: 'Batch not found.' })
      return
    }
    sendJson(response, 200, {
      line: 'Batch ready.',
      profile: {
        loyaltyPoints: client.loyalty_points
      },
      location: mapLocationRow(client),
      batch: mapInventoryRow(row)
    })
  } catch (error) {
    console.error('Order batch error', error)
    sendJson(response, 500, { error: 'Unable to load batch.' })
  }
}

async function handleCreateOrder(request, response) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = session.data.customerId
  try {
    const client = await getClientRecord(clientId)
    if (!client) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    const body = await readBody(request)
    const batchId = Number(body.batchId)
    const quantity = Number(body.quantity)
    const loyaltyUse = Math.max(0, Number(body.loyaltyUse) || 0)
    const deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null
    let locationId = body.locationId ? Number(body.locationId) : client.location_id
    if (!batchId || Number.isNaN(batchId)) {
      sendJson(response, 400, { error: 'Batch is required.' })
      return
    }
    if (!quantity || quantity <= 0) {
      sendJson(response, 400, { error: 'Quantity must be greater than zero.' })
      return
    }
    if (!deliveryDate || Number.isNaN(deliveryDate.getTime())) {
      sendJson(response, 400, { error: 'Invalid delivery date.' })
      return
    }
    const orderDate = new Date()
    if (deliveryDate < orderDate) {
      sendJson(response, 400, { error: 'Delivery date cannot be in the past.' })
      return
    }
    const orderDateStr = orderDate.toISOString().split('T')[0]
    const deliveryDateStr = deliveryDate.toISOString().split('T')[0]
    if (body.location && typeof body.location === 'object') {
      try {
        locationId = await createLocationRecord(body.location)
      } catch (error) {
        if (error.statusCode) {
          sendJson(response, error.statusCode, { error: error.message })
          return
        }
        throw error
      }
    }
    if (!locationId) {
      sendJson(response, 400, { error: 'A delivery location is required.' })
      return
    }

    const inventory = await knex('Inventory').where('batch_id', batchId).first()
    if (!inventory || inventory.quantity < quantity) {
      sendJson(response, 400, { error: 'Insufficient inventory for the selected batch.' })
      return
    }
    const unitPrice = Number(inventory.price)
    const subtotal = unitPrice * quantity
    const maxDiscount = Math.min(Math.floor(subtotal), Number(client.loyalty_points))
    const discount = Math.min(Math.floor(loyaltyUse), maxDiscount)
    const total = subtotal - discount
    const pointsEarned = Math.floor(total / 100)
    const newLoyalty = Number(client.loyalty_points) - discount + pointsEarned

    try {
      await knex.transaction(async (trx) => {
        await trx('Orders').insert({
          client_id: clientId,
          batch_id: batchId,
          location_id: locationId,
          order_date: orderDateStr,
          quantity,
          is_shipped: 0,
          due_by: deliveryDateStr,
          loyalty_points_used: discount
        })

        await trx('Inventory')
          .where('batch_id', batchId)
          .decrement('quantity', quantity)

        await trx('Client')
          .where('client_id', clientId)
          .update({ loyalty_points: newLoyalty })
      })
    } catch (error) {
      console.error('Order creation transaction failed', error)
      throw error
    }

    sendJson(response, 201, {
      line: 'Order placed successfully.',
      loyaltyPoints: newLoyalty,
      order: {
        batchId,
        quantity,
        subtotal,
        discount,
        total,
        pointsEarned
      }
    })
  } catch (error) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else {
      console.error('Create order error', error)
      sendJson(response, 500, { error: 'Unable to place order.' })
    }
  }
}

async function handleFarmerDashboard(request, response) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  try {
    const data = await fetchFarmerDashboardData(session.data.farmId)
    if (!data) {
      sendJson(response, 404, { error: 'Farm not found.' })
      return
    }
    sendJson(response, 200, {
      line: 'Farmer console ready.',
      ...data
    })
  } catch (error) {
    console.error('Farmer dashboard error', error)
    sendJson(response, 500, { error: 'Unable to load farmer data.' })
  }
}

async function handleFarmerInventoryCreate(request, response) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = session.data.farmId
  try {
    const body = await readBody(request)
    const productId = Number(body.productId)
    const price = Number(body.price)
    const weight = Number(body.weight)
    const quantity = Number(body.quantity)
    const expDate = body.expDate ? new Date(body.expDate) : null
    const notes = body.notes ? String(body.notes).trim() : null

    if (!productId || Number.isNaN(productId)) {
      sendJson(response, 400, { error: 'Product is required.' })
      return
    }
    if (Number.isNaN(price) || price < 0) {
      sendJson(response, 400, { error: 'Enter a valid price.' })
      return
    }
    if (Number.isNaN(weight) || weight <= 0) {
      sendJson(response, 400, { error: 'Weight must be greater than zero.' })
      return
    }
    if (Number.isNaN(quantity) || quantity <= 0) {
      sendJson(response, 400, { error: 'Quantity must be greater than zero.' })
      return
    }
    if (!expDate || Number.isNaN(expDate.getTime())) {
      sendJson(response, 400, { error: 'Expiration date is required.' })
      return
    }

    const productLink = await knex('FarmProduct')
      .where({ product_id: productId, farm_id: farmId })
      .first()
    if (!productLink) {
      sendJson(response, 400, { error: 'Add this product to your offerings before stocking it.' })
      return
    }

    const expDateStr = expDate.toISOString().split('T')[0]
    const insertResult = await knex('Inventory').insert({
      product_id: productId,
      farm_id: farmId,
      price,
      weight,
      notes,
      exp_date: expDateStr,
      quantity
    })
    const batchId = Array.isArray(insertResult) ? insertResult[0] : insertResult
    const row = await fetchInventoryRow(batchId)
    sendJson(response, 201, {
      line: 'Inventory batch added.',
      batch: row ? mapInventoryRow(row) : null
    })
  } catch (error) {
    console.error('Farmer inventory create error', error)
    sendJson(response, 500, { error: 'Unable to add inventory.' })
  }
}

async function handleFarmerInventoryUpdate(request, response, batchId) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = session.data.farmId
  if (!batchId) {
    sendJson(response, 400, { error: 'Batch ID is required.' })
    return
  }
  try {
    const body = await readBody(request)
    const updates = {}
    if (body.price !== undefined) {
      const price = Number(body.price)
      if (Number.isNaN(price) || price < 0) {
        sendJson(response, 400, { error: 'Enter a valid price.' })
        return
      }
      updates.price = price
    }
    if (body.weight !== undefined) {
      const weight = Number(body.weight)
      if (Number.isNaN(weight) || weight <= 0) {
        sendJson(response, 400, { error: 'Weight must be greater than zero.' })
        return
      }
      updates.weight = weight
    }
    if (body.quantity !== undefined) {
      const quantity = Number(body.quantity)
      if (Number.isNaN(quantity) || quantity < 0) {
        sendJson(response, 400, { error: 'Quantity cannot be negative.' })
        return
      }
      updates.quantity = quantity
    }
    if (body.expDate) {
      const expDate = new Date(body.expDate)
      if (Number.isNaN(expDate.getTime())) {
        sendJson(response, 400, { error: 'Expiration date is invalid.' })
        return
      }
      updates.exp_date = expDate.toISOString().split('T')[0]
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes ? String(body.notes).trim() : null
    }
    if (Object.keys(updates).length === 0) {
      sendJson(response, 400, { error: 'No inventory fields provided.' })
      return
    }
    const existing = await knex('Inventory')
      .where({ batch_id: batchId, farm_id: farmId })
      .first()
    if (!existing) {
      sendJson(response, 404, { error: 'Batch not found.' })
      return
    }
    await knex('Inventory').where('batch_id', batchId).update(updates)
    const updated = await fetchInventoryRow(batchId)
    sendJson(response, 200, {
      line: 'Inventory updated.',
      batch: updated ? mapInventoryRow(updated) : null
    })
  } catch (error) {
    console.error('Farmer inventory update error', error)
    sendJson(response, 500, { error: 'Unable to update inventory.' })
  }
}

async function handleFarmerInventoryDelete(request, response, batchId) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = session.data.farmId
  if (!batchId) {
    sendJson(response, 400, { error: 'Batch ID is required.' })
    return
  }
  try {
    const existing = await knex('Inventory')
      .where({ batch_id: batchId, farm_id: farmId })
      .first()
    if (!existing) {
      sendJson(response, 404, { error: 'Batch not found.' })
      return
    }
    try {
      await knex('Inventory').where('batch_id', batchId).delete()
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        sendJson(response, 409, { error: 'Cannot delete a batch that is referenced by orders.' })
        return
      }
      throw error
    }
    sendJson(response, 200, { line: 'Inventory batch removed.' })
  } catch (error) {
    console.error('Farmer inventory delete error', error)
    sendJson(response, 500, { error: 'Unable to delete inventory batch.' })
  }
}

async function handleFarmerFulfillment(request, response) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = session.data.farmId
  try {
    const body = await readBody(request)
    const mode = String(body.mode || body.type || '').toLowerCase()
    const batchId = body.batchId != null ? Number(body.batchId) : null
    const dueDate = body.dueDate ? new Date(body.dueDate) : null
    const dueDateStr = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString().split('T')[0] : null

    if (body.dueDate && !dueDateStr) {
      sendJson(response, 400, { error: 'Enter a valid target date.' })
      return
    }

    let orderId = null
    if (mode === 'order') {
      const orderIdInput = Number(body.orderId)
      if (!orderIdInput || Number.isNaN(orderIdInput)) {
        sendJson(response, 400, { error: 'Order ID is required for this fulfillment.' })
        return
      }
      await knex.transaction(async (trx) => {
        const orderRow = await trx('Orders as o')
          .leftJoin('Inventory as inv', 'o.batch_id', 'inv.batch_id')
          .select(
            'o.order_id',
            'o.batch_id',
            'o.quantity',
            'o.is_shipped',
            'o.due_by',
            'inv.farm_id',
            'inv.product_id'
          )
          .where('o.order_id', orderIdInput)
          .forUpdate()
          .first()

        if (!orderRow) {
          throw httpError(404, 'Order not found.')
        }
        if (orderRow.farm_id !== farmId) {
          throw httpError(403, 'Cannot fulfill orders for another farm.')
        }
        if (orderRow.is_shipped) {
          throw httpError(400, 'Order is already marked as shipped.')
        }

        await trx('Orders').where('order_id', orderIdInput).update({
          is_shipped: 1,
          due_by: dueDateStr || orderRow.due_by
        })
        orderId = orderIdInput
      })
    } else if (mode === 'subscription') {
      const programId = Number(body.programId)
      if (!programId || Number.isNaN(programId)) {
        sendJson(response, 400, { error: 'Program ID is required to fulfill a subscription.' })
        return
      }
      if (!batchId || Number.isNaN(batchId)) {
        sendJson(response, 400, { error: 'Select a batch from your inventory.' })
        return
      }
      const explicitQuantity = body.quantity !== undefined ? Number(body.quantity) : undefined
      await knex.transaction(async (trx) => {
        const subscription = await trx('Subscription')
          .where('program_id', programId)
          .forUpdate()
          .first()
        if (!subscription) {
          throw httpError(404, 'Subscription not found.')
        }
        if (subscription.farm_id !== farmId) {
          throw httpError(403, 'Cannot fulfill another farm’s subscription.')
        }
        if (subscription.status !== 'ACTIVE') {
          throw httpError(400, 'Only active subscriptions can be fulfilled.')
        }

        const targetQuantity = explicitQuantity != null && !Number.isNaN(explicitQuantity)
          ? explicitQuantity
          : Number(subscription.quantity)
        if (!targetQuantity || targetQuantity <= 0) {
          throw httpError(400, 'Enter a valid fulfillment quantity.')
        }

        const batch = await trx('Inventory')
          .where({ batch_id: batchId, farm_id: farmId })
          .forUpdate()
          .first()
        if (!batch) {
          throw httpError(404, 'Selected batch not found.')
        }
        if (batch.product_id !== subscription.product_id) {
          throw httpError(400, 'Batch does not match this subscription’s product.')
        }
        if (batch.quantity < targetQuantity) {
          throw httpError(400, 'Insufficient inventory to fulfill the subscription.')
        }

        await trx('Inventory').where('batch_id', batchId).decrement('quantity', targetQuantity)
        const orderDate = new Date()
        const orderDateStr = orderDate.toISOString().split('T')[0]
        const dueByStr = dueDateStr || orderDateStr
        const inserted = await trx('Orders').insert({
          client_id: subscription.client_id,
          batch_id: batchId,
          location_id: subscription.location_id,
          order_date: orderDateStr,
          quantity: targetQuantity,
          is_shipped: 1,
          due_by: dueByStr,
          loyalty_points_used: 0,
          program_id: subscription.program_id
        })
        orderId = Array.isArray(inserted) ? inserted[0] : inserted
        if (subscription.status === 'QUOTED') {
          await trx('Subscription').where('program_id', programId).update({ status: 'ACTIVE' })
        }
      })
    } else {
      sendJson(response, 400, { error: 'mode must be either "order" or "subscription".' })
      return
    }

    const orderRow = orderId ? await fetchOrderRow(orderId) : null
    const subscriptionRow = (mode === 'subscription' && body.programId)
      ? await fetchFarmerSubscriptionRow(Number(body.programId))
      : (orderRow?.program_id ? await fetchFarmerSubscriptionRow(orderRow.program_id) : null)

    sendJson(response, 200, {
      line: 'Fulfillment recorded.',
      order: orderRow ? mapFarmerOrderRow(orderRow) : null,
      subscription: subscriptionRow ? mapFarmerSubscriptionRow(subscriptionRow) : null
    })
  } catch (error) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
      return
    }
    console.error('Farmer fulfillment error', error)
    sendJson(response, 500, { error: 'Unable to record fulfillment.' })
  }
}

async function handleFarmerSubscriptionUpdate(request, response, programId) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = session.data.farmId
  if (!programId) {
    sendJson(response, 400, { error: 'Program ID is required.' })
    return
  }
  try {
    const body = await readBody(request)
    const updates = {}
    const requestedStatus = body.status ? String(body.status).toUpperCase() : null
    const priceProvided = body.price !== undefined
    const priceValue = priceProvided ? Number(body.price) : null
    if (priceProvided && (Number.isNaN(priceValue) || priceValue < 0)) {
      sendJson(response, 400, { error: 'Enter a valid quote price.' })
      return
    }
    if (!requestedStatus && !priceProvided) {
      sendJson(response, 400, { error: 'Provide a quote or status update.' })
      return
    }
    const existing = await knex('Subscription')
      .where({ program_id: programId, farm_id: farmId })
      .first()
    if (!existing) {
      sendJson(response, 404, { error: 'Subscription not found.' })
      return
    }
    if (requestedStatus) {
      if (!['QUOTED', 'CANCELLED'].includes(requestedStatus)) {
        sendJson(response, 400, { error: 'Farmers can only quote or cancel subscriptions.' })
        return
      }
      if (requestedStatus === 'QUOTED') {
        if (existing.status !== 'AWAITING_QUOTE') {
          sendJson(response, 400, { error: 'Only pending requests can be quoted.' })
          return
        }
        if (!priceProvided && existing.price == null) {
          sendJson(response, 400, { error: 'Provide a price before sending a quote.' })
          return
        }
        updates.status = 'QUOTED'
        if (priceProvided) {
          updates.price = priceValue
        }
      } else if (requestedStatus === 'CANCELLED') {
        const cancellable = existing.status === 'AWAITING_QUOTE' || existing.status === 'ACTIVE'
        if (!cancellable) {
          sendJson(response, 400, { error: 'Only pending or active subscriptions can be cancelled by the farm.' })
          return
        }
        updates.status = 'CANCELLED'
      }
    }

    if (!requestedStatus && priceProvided) {
      if (existing.status !== 'AWAITING_QUOTE') {
        sendJson(response, 400, { error: 'Only pending requests can update the quote price.' })
        return
      }
      updates.price = priceValue
    }

    if (Object.keys(updates).length === 0) {
      sendJson(response, 400, { error: 'No applicable subscription updates found.' })
      return
    }

    await knex('Subscription').where('program_id', programId).update(updates)
    const refreshed = await fetchFarmerSubscriptionRow(programId)
    sendJson(response, 200, {
      line: 'Subscription updated.',
      subscription: refreshed ? mapFarmerSubscriptionRow(refreshed) : null
    })
  } catch (error) {
    console.error('Farmer subscription update error', error)
    sendJson(response, 500, { error: 'Unable to update subscription.' })
  }
}

async function handleFarmerOfferingsCreate(request, response) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = session.data.farmId
  try {
    const body = await readBody(request)
    const productId = Number(body.productId)
    const population = body.population != null ? Number(body.population) : 0
    if (!productId || Number.isNaN(productId)) {
      sendJson(response, 400, { error: 'Product is required.' })
      return
    }
    if (Number.isNaN(population) || population < 0) {
      sendJson(response, 400, { error: 'Population must be zero or greater.' })
      return
    }
    const product = await knex('RawProduct').where('product_id', productId).first()
    if (!product) {
      sendJson(response, 404, { error: 'Product not found.' })
      return
    }
    try {
      await knex('FarmProduct').insert({
        product_id: productId,
        farm_id: farmId,
        population
      })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        sendJson(response, 409, { error: 'This product is already in your offerings.' })
        return
      }
      throw error
    }
    const offering = await knex('FarmProduct as fp')
      .leftJoin('RawProduct as rp', 'fp.product_id', 'rp.product_id')
      .select(
        'fp.product_id',
        'fp.farm_id',
        'fp.population',
        'rp.product_name',
        'rp.product_type',
        'rp.grade'
      )
      .where('fp.product_id', productId)
      .andWhere('fp.farm_id', farmId)
      .first()
    sendJson(response, 201, {
      line: 'Product offering added.',
      offering: offering ? mapFarmOfferingRow(offering) : null
    })
  } catch (error) {
    console.error('Farmer offerings create error', error)
    sendJson(response, 500, { error: 'Unable to add offering.' })
  }
}

async function handleFarmerOfferingsUpdate(request, response, productId) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = session.data.farmId
  if (!productId) {
    sendJson(response, 400, { error: 'Product ID is required.' })
    return
  }
  try {
    const body = await readBody(request)
    const population = Number(body.population)
    if (Number.isNaN(population) || population < 0) {
      sendJson(response, 400, { error: 'Population must be zero or greater.' })
      return
    }
    const affected = await knex('FarmProduct')
      .where({ product_id: productId, farm_id: farmId })
      .update({ population })
    if (!affected) {
      sendJson(response, 404, { error: 'Offering not found.' })
      return
    }
    const offering = await knex('FarmProduct as fp')
      .leftJoin('RawProduct as rp', 'fp.product_id', 'rp.product_id')
      .select(
        'fp.product_id',
        'fp.farm_id',
        'fp.population',
        'rp.product_name',
        'rp.product_type',
        'rp.grade'
      )
      .where('fp.product_id', productId)
      .andWhere('fp.farm_id', farmId)
      .first()
    sendJson(response, 200, {
      line: 'Offering updated.',
      offering: offering ? mapFarmOfferingRow(offering) : null
    })
  } catch (error) {
    console.error('Farmer offerings update error', error)
    sendJson(response, 500, { error: 'Unable to update offering.' })
  }
}

async function handleFarmerOfferingsDelete(request, response, productId) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = session.data.farmId
  if (!productId) {
    sendJson(response, 400, { error: 'Product ID is required.' })
    return
  }
  try {
    const affected = await knex('FarmProduct')
      .where({ product_id: productId, farm_id: farmId })
      .delete()
    if (!affected) {
      sendJson(response, 404, { error: 'Offering not found.' })
      return
    }
    sendJson(response, 200, { line: 'Offering removed.' })
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      sendJson(response, 409, { error: 'Offering is still referenced by inventory or subscriptions.' })
      return
    }
    console.error('Farmer offerings delete error', error)
    sendJson(response, 500, { error: 'Unable to remove offering.' })
  }
}

async function serveStatic(pathname, response) {
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
      return serveStatic(path.join(relativePath, 'index.html'), response)
    }
    const ext = path.extname(fullPath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const data = await fs.readFile(fullPath)
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length
    })
    response.end(data)
  } catch (error) {
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

async function routeRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`)
  const { pathname } = url
  const farmerInventoryMatch = pathname.match(/^\/api\/farmer\/inventory\/(\d+)$/)
  const farmerSubscriptionMatch = pathname.match(/^\/api\/farmer\/subscriptions\/(\d+)$/)
  const farmerOfferingMatch = pathname.match(/^\/api\/farmer\/offerings\/(\d+)$/)
  const adminEntityMatch = pathname.match(/^\/api\/admin\/entities\/([^/]+)\/([^/]+)$/)

  try {
    if (request.method === 'POST' && pathname === '/api/login/customer') {
      await handleCustomerLogin(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/login/farmer') {
      await handleFarmerLogin(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/login/admin') {
      await handleAdminLogin(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/session') {
      await handleSessionRead(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/logout') {
      await handleLogout(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/dashboard') {
      await handleCustomerDashboard(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/subscriptions') {
      await handleCustomerSubscriptions(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/customer/subscriptions') {
      await handleCreateSubscription(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/subscriptions/offers') {
      await handleProductOffers(request, response, url.searchParams)
      return
    }
    if (request.method === 'POST' && pathname === '/api/customer/locations') {
      await handleCreateLocation(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/account') {
      await handleAccountRead(request, response)
      return
    }
    if (request.method === 'PUT' && pathname === '/api/customer/account') {
      await handleAccountUpdate(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/orders/options') {
      await handleOrderOptions(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/orders/batch') {
      await handleOrderBatch(request, response, url.searchParams)
      return
    }
    if (request.method === 'POST' && pathname === '/api/customer/orders') {
      await handleCreateOrder(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/admin/overview') {
      await handleAdminOverview(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/admin/entities') {
      await handleAdminEntityCreate(request, response)
      return
    }
    if (adminEntityMatch && request.method === 'PUT') {
      await handleAdminEntityUpdate(request, response, adminEntityMatch[1], adminEntityMatch[2])
      return
    }
    if (adminEntityMatch && request.method === 'DELETE') {
      await handleAdminEntityDelete(request, response, adminEntityMatch[1], adminEntityMatch[2])
      return
    }
    if (request.method === 'GET' && pathname === '/api/farmer/dashboard') {
      await handleFarmerDashboard(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/farmer/inventory') {
      await handleFarmerInventoryCreate(request, response)
      return
    }
    if (farmerInventoryMatch && request.method === 'PUT') {
      await handleFarmerInventoryUpdate(request, response, Number(farmerInventoryMatch[1]))
      return
    }
    if (farmerInventoryMatch && request.method === 'DELETE') {
      await handleFarmerInventoryDelete(request, response, Number(farmerInventoryMatch[1]))
      return
    }
    if (request.method === 'POST' && pathname === '/api/farmer/fulfillments') {
      await handleFarmerFulfillment(request, response)
      return
    }
    if (farmerSubscriptionMatch && request.method === 'PUT') {
      await handleFarmerSubscriptionUpdate(request, response, Number(farmerSubscriptionMatch[1]))
      return
    }
    if (request.method === 'POST' && pathname === '/api/farmer/offerings') {
      await handleFarmerOfferingsCreate(request, response)
      return
    }
    if (farmerOfferingMatch && request.method === 'PUT') {
      await handleFarmerOfferingsUpdate(request, response, Number(farmerOfferingMatch[1]))
      return
    }
    if (farmerOfferingMatch && request.method === 'DELETE') {
      await handleFarmerOfferingsDelete(request, response, Number(farmerOfferingMatch[1]))
      return
    }

    await serveStatic(pathname, response)
  } catch (error) {
    console.error('Request error', error)
    if (!response.headersSent) {
      sendJson(response, 500, { error: 'Unexpected server error.' })
    } else {
      response.end()
    }
  }
}

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
