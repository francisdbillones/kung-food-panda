import { IncomingMessage, ServerResponse } from 'http'
import { URLSearchParams } from 'url'
import knex from '../../models/knexfile.js'
import { readBody, sendJson } from '../lib/http'
import { formatLocationLabel } from '../lib/locations'
import { httpError } from '../lib/errors'
import { requireSession } from '../services/sessionService'
import {
  mapFarmOffer,
  mapInventoryRow,
  mapLocationRow,
  mapOrderRow,
  mapProductDetail,
  mapProductRow,
  mapSubscriptionRow
} from '../services/mappers'

async function getClientRecord(clientId: number) {
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
      'loc.country',
      'loc.continent'
    )
    .where('c.client_id', clientId)
    .first()
}

function buildSubscriptionQuery(clientId: number) {
  return knex('Subscription as s')
    .leftJoin('RawProduct as rp', 's.product_id', 'rp.product_id')
    .leftJoin('Farm as f', 's.farm_id', 'f.farm_id')
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
      'rp.grade',
      'f.name as farm_name',
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

function farmOffersQuery(productId: number) {
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

async function createLocationRecord(locationPayload: any) {
  const continent = locationPayload.continent || 'Asia'
  const country = locationPayload.country || 'Philippines'
  const state = locationPayload.state || null
  const city = locationPayload.city
  const street = locationPayload.street
  if (!city || !street) {
    throw httpError(400, 'Location requires city and street.')
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

async function fetchCustomerDashboardData(clientId: number) {
  const client = await getClientRecord(clientId)
  if (!client) {
    return null
  }

  const pendingOrdersPromise = knex('Orders as o')
    .leftJoin('Inventory as i', 'o.batch_id', 'i.batch_id')
    .leftJoin('RawProduct as rp', 'i.product_id', 'rp.product_id')
    .leftJoin('Farm as f', 'i.farm_id', 'f.farm_id')
    .select(
      'o.order_id',
      'o.order_date',
      'o.due_by',
      'o.quantity',
      'o.loyalty_points_used',
      'i.price as unit_price',
      'rp.product_name',
      'rp.grade',
      'i.farm_id',
      'f.name as farm_name',
      'o.shipped_date'
    )
    .where('o.client_id', clientId)
    .whereNull('o.shipped_date')
    .orderBy('o.due_by', 'asc')
    .limit(5)

  const recentOrdersPromise = knex('Orders as o')
    .leftJoin('Inventory as i', 'o.batch_id', 'i.batch_id')
    .leftJoin('RawProduct as rp', 'i.product_id', 'rp.product_id')
    .leftJoin('Farm as f', 'i.farm_id', 'f.farm_id')
    .select(
      'o.order_id',
      'o.order_date',
      'o.due_by',
      'o.quantity',
      'o.loyalty_points_used',
      'i.price as unit_price',
      'rp.product_name',
      'rp.grade',
      'i.farm_id',
      'f.name as farm_name',
      'o.shipped_date'
    )
    .where('o.client_id', clientId)
    .orderBy('o.order_date', 'desc')
    .limit(5)

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

export async function handleCustomerDashboard(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = Number(session.data.customerId)
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

export async function handleCustomerSubscriptions(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = Number(session.data.customerId)
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
export async function handleCreateSubscription(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = Number(session.data.customerId)
  try {
    const client = await getClientRecord(clientId)
    if (!client) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    const body = await readBody<any>(request)
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
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        sendJson(response, 409, { error: 'You are already subscribed to this product.' })
        return
      }
      throw error
    }

    const newSubscription = await knex('Subscription').where({ program_id: programId }).first()
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

export async function handleProductOffers(request: IncomingMessage, response: ServerResponse, searchParams: URLSearchParams) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const productId = Number(searchParams.get('productId'))
  if (!productId) {
    sendJson(response, 400, { error: 'productId is required.' })
    return
  }
  try {
    const client = await getClientRecord(Number(session.data.customerId))
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

export async function handleCreateLocation(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  try {
    const body = await readBody<any>(request)
    const newId = await createLocationRecord(body)
    const location = await knex('Location').where('location_id', newId).first()
    sendJson(response, 201, {
      line: 'Location saved.',
      location: mapLocationRow(location)
    })
  } catch (error: any) {
    console.error('Create location error', error)
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else {
      sendJson(response, 500, { error: 'Unable to save location.' })
    }
  }
}

export async function handleAccountRead(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  try {
    const client = await getClientRecord(Number(session.data.customerId))
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

export async function handleAccountUpdate(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = Number(session.data.customerId)
  try {
    const body = await readBody<any>(request)
    const updates: Record<string, any> = {}
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
      } catch (error: any) {
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

export async function handleOrderOptions(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  try {
    const client = await getClientRecord(Number(session.data.customerId))
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

export async function handleOrderBatch(request: IncomingMessage, response: ServerResponse, searchParams: URLSearchParams) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const batchId = Number(searchParams.get('batchId'))
  if (!batchId) {
    sendJson(response, 400, { error: 'batchId is required.' })
    return
  }
  try {
    const client = await getClientRecord(Number(session.data.customerId))
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

export async function handleCreateOrder(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'customer')
  if (!session) return
  const clientId = Number(session.data.customerId)
  try {
    const client = await getClientRecord(clientId)
    if (!client) {
      sendJson(response, 404, { error: 'Customer not found.' })
      return
    }
    const body = await readBody<any>(request)
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
      } catch (error: any) {
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
          shipped_date: null,
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
  } catch (error: any) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
    } else {
      console.error('Create order error', error)
      sendJson(response, 500, { error: 'Unable to place order.' })
    }
  }
}
