import knex from '../models/knexfile'
import { httpError } from '../lib/errors'

export interface AdminFieldConfig {
  column: string
  label: string
  type: 'number' | 'text' | 'date'
  readOnly?: boolean
}

export interface AdminEntityConfig {
  key: string
  label: string
  table: string
  primaryKey: string[]
  autoIncrement: boolean
  fields: AdminFieldConfig[]
  defaultSort?: [string, 'asc' | 'desc']
}

const ADMIN_ENTITIES: Record<string, Omit<AdminEntityConfig, 'key'>> = {
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
      { column: 'shipped_date', label: 'Shipped Date', type: 'date' },
      { column: 'due_by', label: 'Due By', type: 'date' },
      { column: 'loyalty_points_used', label: 'Loyalty Points Used', type: 'number' }
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

function normalizeAdminEntityKey(name: string | undefined | null): string {
  return String(name || '').trim().toLowerCase()
}

export function getAdminEntityConfig(name: string): AdminEntityConfig {
  const key = normalizeAdminEntityKey(name)
  const config = ADMIN_ENTITIES[key]
  if (!config) {
    throw httpError(400, 'Unknown admin entity.')
  }
  return { key, ...config }
}

export function adminMetadataSnapshot(): Record<string, Pick<AdminEntityConfig, 'label' | 'primaryKey' | 'autoIncrement' | 'fields'>> {
  return Object.entries(ADMIN_ENTITIES).reduce((acc, [key, config]) => {
    acc[key] = {
      label: config.label,
      primaryKey: config.primaryKey,
      autoIncrement: config.autoIncrement,
      fields: config.fields
    }
    return acc
  }, {} as Record<string, Pick<AdminEntityConfig, 'label' | 'primaryKey' | 'autoIncrement' | 'fields'>>)
}

export async function fetchAdminEntityRows(config: AdminEntityConfig): Promise<any[]> {
  let query = knex(config.table).select(projectAdminFields(config))
  if (config.defaultSort) {
    query = query.orderBy(config.defaultSort[0], config.defaultSort[1] || 'asc')
  }
  return query.limit(250)
}

function projectAdminFields(config: AdminEntityConfig): string[] {
  return config.fields.map((field) => field.column)
}

function getAdminField(config: AdminEntityConfig, column: string): AdminFieldConfig | undefined {
  return config.fields.find((field) => field.column === column)
}

export function coerceAdminValue(field: AdminFieldConfig | undefined, raw: any): any {
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

export function sanitizeAdminPayload(config: AdminEntityConfig, payload: Record<string, any>, { includePrimaryKeys = true } = {}): Record<string, any> {
  const output: Record<string, any> = {}
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

export async function ensurePrimaryKeysPresent(config: AdminEntityConfig, values: Record<string, any>): Promise<Record<string, any>> {
  const pkValues: Record<string, any> = {}
  const missing: string[] = []
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

export function parseAdminIdentifier(config: AdminEntityConfig, rawId: string): Record<string, any> {
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
  }, {} as Record<string, any>)
}

async function generateAdminPrimaryKey(config: AdminEntityConfig): Promise<number | null> {
  if (config.autoIncrement || config.primaryKey.length !== 1) {
    return null
  }
  const column = config.primaryKey[0]
  const maxRow = await knex(config.table).max({ maxId: column }).first()
  return (maxRow?.maxId || 0) + 1
}
