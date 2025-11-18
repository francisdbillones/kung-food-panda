import { IncomingMessage, ServerResponse } from 'http'
import knex from '../models/knexfile'
import { readBody, sendJson } from '../lib/http'
import { requireSession } from '../services/sessionService'
import {
  adminMetadataSnapshot,
  ensurePrimaryKeysPresent,
  fetchAdminEntityRows,
  getAdminEntityConfig,
  parseAdminIdentifier,
  sanitizeAdminPayload
} from '../services/adminMetadata'

export async function handleAdminOverview(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const metadata = adminMetadataSnapshot()
    const entries = await Promise.all(Object.keys(metadata).map(async (key) => {
      const config = getAdminEntityConfig(key)
      const rows = await fetchAdminEntityRows(config)
      return [key, rows] as const
    }))
    const data = Object.fromEntries(entries)
    sendJson(response, 200, {
      line: 'Admin overview ready.',
      metadata,
      data
    })
  } catch (error) {
    console.error('Admin overview error', error)
    sendJson(response, 500, { error: 'Unable to load admin data.' })
  }
}

export async function handleAdminEntityCreate(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const body = await readBody<any>(request)
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
      const whereClause: Record<string, any> = {}
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
  } catch (error: any) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else {
      console.error('Admin entity create error', error)
      sendJson(response, 500, { error: 'Unable to create record.' })
    }
  }
}

export async function handleAdminEntityUpdate(request: IncomingMessage, response: ServerResponse, entityName: string, identifier: string) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const config = getAdminEntityConfig(entityName)
    const keyWhere = parseAdminIdentifier(config, identifier)
    const body = await readBody<any>(request)
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
  } catch (error: any) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else {
      console.error('Admin entity update error', error)
      sendJson(response, 500, { error: 'Unable to update record.' })
    }
  }
}

export async function handleAdminEntityDelete(request: IncomingMessage, response: ServerResponse, entityName: string, identifier: string) {
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
  } catch (error: any) {
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
