import { IncomingMessage, ServerResponse } from 'http'
import knex from '../models/knexfile'
import { readBody, sendJson } from '../lib/http'
import { httpError } from '../lib/errors'
import { normalizeDateOnly, toISODate } from '../lib/dates'
import { requireSession } from '../services/sessionService'
import {
  mapFarmOfferingRow,
  mapFarmRow,
  mapFarmerOrderRow,
  mapFarmerSubscriptionRow,
  mapInventoryRow,
  mapRawProductLite
} from '../services/mappers'

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
      'o.batch_id',
      'o.order_date',
      'o.due_by',
      'o.quantity',
      'o.shipped_date',
      'c.client_id',
      'c.first_name as client_first_name',
      'c.last_name as client_last_name',
      'c.company_name',
      'inv.farm_id',
      'inv.product_id',
      'inv.price as unit_price',
      'inv.weight as unit_weight',
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

async function fetchInventoryRow(batchId: number) {
  return inventoryDetailQuery().where('inv.batch_id', batchId).first()
}

async function fetchOrderRow(orderId: number) {
  return farmerOrderDetailQuery().where('o.order_id', orderId).first()
}

async function fetchFarmerSubscriptionRow(programId: number) {
  return farmerSubscriptionDetailQuery().where('s.program_id', programId).first()
}

function isBeforeToday(value: unknown): boolean {
  const date = normalizeDateOnly(value)
  if (!date) return false
  const today = normalizeDateOnly(new Date())
  if (!today) return false
  return date.getTime() < today.getTime()
}

async function getFarmRecord(farmId: number) {
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

async function fetchFarmerDashboardData(farmId: number) {
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
      'fp.population_unit',
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

  const pendingOrders = ordersRows.filter((row) => !row.shipped_date)
  const fulfilledOrders = ordersRows.filter((row) => row.shipped_date).slice(0, 5)

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

export async function handleFarmerDashboard(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  try {
    const data = await fetchFarmerDashboardData(Number(session.data.farmId))
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

export async function handleFarmerInventoryCreate(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
  try {
    const body = await readBody<any>(request)
    const productId = Number(body.productId)
    const price = Number(body.price)
    const weight = Number(body.weight)
    const quantity = Number(body.quantity)
    const expDate = normalizeDateOnly(body.expDate)
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
    if (isBeforeToday(expDate)) {
      sendJson(response, 400, { error: 'Expiration date cannot be in the past.' })
      return
    }

    const productLink = await knex('FarmProduct')
      .where({ product_id: productId, farm_id: farmId })
      .first()
    if (!productLink) {
      sendJson(response, 400, { error: 'Add this product to your offerings before stocking it.' })
      return
    }

    const expDateStr = toISODate(expDate)
    if (!expDateStr) {
      sendJson(response, 400, { error: 'Expiration date is invalid.' })
      return
    }
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

export async function handleFarmerInventoryUpdate(request: IncomingMessage, response: ServerResponse, batchId?: number) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
  if (!batchId) {
    sendJson(response, 400, { error: 'Batch ID is required.' })
    return
  }
  try {
    const body = await readBody<any>(request)
    const updates: Record<string, any> = {}
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
      const qty = Number(body.quantity)
      if (Number.isNaN(qty) || qty < 0) {
        sendJson(response, 400, { error: 'Quantity cannot be negative.' })
        return
      }
      updates.quantity = qty
    }
    if (body.expDate) {
      const expDate = normalizeDateOnly(body.expDate)
      if (!expDate || Number.isNaN(expDate.getTime())) {
        sendJson(response, 400, { error: 'Expiration date is invalid.' })
        return
      }
      if (isBeforeToday(expDate)) {
        sendJson(response, 400, { error: 'Expiration date cannot be in the past.' })
        return
      }
      const expDateStr = toISODate(expDate)
      if (!expDateStr) {
        sendJson(response, 400, { error: 'Expiration date is invalid.' })
        return
      }
      updates.exp_date = expDateStr
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

export async function handleFarmerInventoryDelete(request: IncomingMessage, response: ServerResponse, batchId?: number) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
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
    } catch (error: any) {
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

export async function handleFarmerFulfillment(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
  try {
    const body = await readBody<any>(request)
    const mode = String(body.mode || body.type || '').toLowerCase()
    const batchId = body.batchId != null ? Number(body.batchId) : null
    const dueDate = body.dueDate ? new Date(body.dueDate) : null
    const dueDateStr = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString().split('T')[0] : null

    if (body.dueDate && !dueDateStr) {
      sendJson(response, 400, { error: 'Enter a valid target date.' })
      return
    }

    let orderId: number | null = null
    let fulfilledProgramId: number | null = null
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
            'o.shipped_date',
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
        if (orderRow.shipped_date) {
          throw httpError(400, 'Order is already marked as shipped.')
        }

        const shippedDateValue = toISODate(new Date())
        await trx('Orders').where('order_id', orderIdInput).update({
          shipped_date: shippedDateValue,
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
      fulfilledProgramId = programId
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
          due_by: dueByStr,
          shipped_date: orderDateStr,
          loyalty_points_used: 0
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
    const subscriptionRow = fulfilledProgramId ? await fetchFarmerSubscriptionRow(fulfilledProgramId) : null
    sendJson(response, 200, {
      line: 'Fulfillment recorded.',
      order: orderRow ? mapFarmerOrderRow(orderRow) : null,
      subscription: subscriptionRow ? mapFarmerSubscriptionRow(subscriptionRow) : null
    })
  } catch (error: any) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else {
      console.error('Farmer fulfillment error', error)
      sendJson(response, 500, { error: 'Unable to record fulfillment.' })
    }
  }
}

export async function handleFarmerSubscriptionUpdate(request: IncomingMessage, response: ServerResponse, programId?: number) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
  if (!programId) {
    sendJson(response, 400, { error: 'Program ID is required.' })
    return
  }
  try {
    const body = await readBody<any>(request)
    const updates: Record<string, any> = {}
    const requestedStatus = body.status ? String(body.status).toUpperCase() : null
    const priceProvided = body.price !== undefined
    const priceValue = priceProvided ? Number(body.price) : null
    if (priceProvided && (priceValue == null || Number.isNaN(priceValue) || priceValue < 0)) {
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
        if (priceProvided && priceValue != null) {
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

export async function handleFarmerOfferingsCreate(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
  try {
    const body = await readBody<any>(request)
    const productId = Number(body.productId)
    const population = Number(body.population || 0)
    const populationUnit = typeof body.populationUnit === 'string' ? body.populationUnit.trim() : ''
    if (!productId || Number.isNaN(productId)) {
      sendJson(response, 400, { error: 'Select a product to add.' })
      return
    }
    if (Number.isNaN(population) || population < 0) {
      sendJson(response, 400, { error: 'Population must be zero or greater.' })
      return
    }
    if (!populationUnit) {
      sendJson(response, 400, { error: 'Specify a population unit.' })
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
        population,
        population_unit: populationUnit
      })
    } catch (error: any) {
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
        'fp.population_unit',
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

export async function handleFarmerOfferingsUpdate(request: IncomingMessage, response: ServerResponse, productId?: number) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
  if (!productId) {
    sendJson(response, 400, { error: 'Product ID is required.' })
    return
  }
  try {
    const body = await readBody<any>(request)
    const updates: Record<string, any> = {}
    if (body.population !== undefined) {
      const population = Number(body.population)
      if (Number.isNaN(population) || population < 0) {
        sendJson(response, 400, { error: 'Population must be zero or greater.' })
        return
      }
      updates.population = population
    }
    if (body.populationUnit !== undefined) {
      const populationUnit = typeof body.populationUnit === 'string' ? body.populationUnit.trim() : ''
      if (!populationUnit) {
        sendJson(response, 400, { error: 'Specify a population unit.' })
        return
      }
      updates.population_unit = populationUnit
    }
    if (!Object.keys(updates).length) {
      sendJson(response, 400, { error: 'No offering fields provided.' })
      return
    }
    const affected = await knex('FarmProduct')
      .where({ product_id: productId, farm_id: farmId })
      .update(updates)
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
        'fp.population_unit',
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

export async function handleFarmerOfferingsDelete(request: IncomingMessage, response: ServerResponse, productId?: number) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
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
  } catch (error: any) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      sendJson(response, 409, { error: 'Offering is still referenced by inventory or subscriptions.' })
      return
    }
    console.error('Farmer offerings delete error', error)
    sendJson(response, 500, { error: 'Unable to remove offering.' })
  }
}
