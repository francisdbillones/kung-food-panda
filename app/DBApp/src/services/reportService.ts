import knex from '../models/knexfile'
import { httpError } from '../lib/errors'
import { toISODate } from '../lib/dates'
import { formatLocationLabel } from '../lib/locations'

export interface SubscriptionReportFilters {
  startDateFrom: string
  startDateTo: string
  productId?: number | null
}

interface FarmContext {
  farmId: number
  name: string | null
  locationLabel: string | null
}

interface ReportOption {
  productId: number
  productName: string
}

export async function listFarmerReportProducts(farmId: number): Promise<ReportOption[]> {
  const rows = await knex('FarmProduct as fp')
    .leftJoin('RawProduct as rp', 'fp.product_id', 'rp.product_id')
    .select('fp.product_id', 'rp.product_name')
    .where('fp.farm_id', farmId)
    .orderBy('rp.product_name', 'asc')
  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name || `Product #${row.product_id}`
  }))
}

export async function listProductsForFarms(farmIds: number[]): Promise<Record<number, ReportOption[]>> {
  if (!farmIds.length) {
    return {}
  }
  const rows = await knex('FarmProduct as fp')
    .leftJoin('RawProduct as rp', 'fp.product_id', 'rp.product_id')
    .select('fp.farm_id', 'fp.product_id', 'rp.product_name')
    .whereIn('fp.farm_id', farmIds)
    .orderBy('rp.product_name', 'asc')
  const map: Record<number, ReportOption[]> = {}
  rows.forEach((row) => {
    if (!map[row.farm_id]) {
      map[row.farm_id] = []
    }
    map[row.farm_id].push({
      productId: row.product_id,
      productName: row.product_name || `Product #${row.product_id}`
    })
  })
  return map
}

export async function listAdminReportFarms(): Promise<Array<{ farmId: number; label: string }>> {
  const rows = await knex('Farm as f')
    .leftJoin('Location as loc', 'f.location_id', 'loc.location_id')
    .select('f.farm_id', 'f.name as farm_name', 'loc.street', 'loc.city', 'loc.state', 'loc.country')
    .orderBy('f.name', 'asc')
  return rows.map((row) => {
    const locationLabel = formatLocationLabel(row)
    const labelParts = [row.farm_name || `Farm #${row.farm_id}`, locationLabel].filter(Boolean)
    return {
      farmId: row.farm_id,
      label: labelParts.join(' · ')
    }
  })
}

async function fetchFarmContext(farmId: number): Promise<FarmContext | null> {
  const row = await knex('Farm as f')
    .leftJoin('Location as loc', 'f.location_id', 'loc.location_id')
    .select('f.farm_id', 'f.name as farm_name', 'loc.street', 'loc.city', 'loc.state', 'loc.country')
    .where('f.farm_id', farmId)
    .first()
  if (!row) return null
  return {
    farmId: row.farm_id,
    name: row.farm_name || null,
    locationLabel: formatLocationLabel(row)
  }
}

async function fetchSubscriptionRows(farmId: number, filters: SubscriptionReportFilters) {
  const query = knex('Subscription as s')
    .leftJoin('Client as c', 's.client_id', 'c.client_id')
    .leftJoin('RawProduct as rp', 's.product_id', 'rp.product_id')
    .leftJoin('Location as loc', 's.location_id', 'loc.location_id')
    .select(
      's.program_id',
      's.product_id',
      's.farm_id',
      's.client_id',
      's.order_interval_days',
      's.start_date',
      's.quantity',
      's.price',
      's.status',
      'c.first_name',
      'c.last_name',
      'c.company_name',
      'rp.product_name',
      'rp.product_type',
      'rp.grade',
      'loc.street',
      'loc.city',
      'loc.state',
      'loc.country'
    )
    .where('s.farm_id', farmId)
    .orderBy('s.start_date', 'desc')

  if (filters.productId) {
    query.andWhere('s.product_id', filters.productId)
  }
  if (filters.startDateFrom) {
    query.andWhere('s.start_date', '>=', filters.startDateFrom)
  }
  if (filters.startDateTo) {
    query.andWhere('s.start_date', '<=', filters.startDateTo)
  }

  const rows = await query
  return rows.map((row) => {
    const clientNameParts = [row.first_name, row.last_name].filter(Boolean)
    const clientName = clientNameParts.join(' ').trim() || `Client #${row.client_id}`
    return {
      programId: row.program_id,
      productId: row.product_id,
      farmId: row.farm_id,
      clientId: row.client_id,
      clientName,
      companyName: row.company_name || null,
      startDate: toISODate(row.start_date),
      quantity: row.quantity != null ? Number(row.quantity) : null,
      intervalDays: row.order_interval_days != null ? Number(row.order_interval_days) : null,
      price: row.price != null ? Number(row.price) : null,
      status: row.status || 'AWAITING_QUOTE',
      productName: row.product_name || `Product #${row.product_id}`,
      productType: row.product_type || null,
      grade: row.grade || null,
      locationLabel: formatLocationLabel(row)
    }
  })
}

async function fetchOfferingRows(farmId: number, productId?: number | null) {
  const query = knex('FarmProduct as fp')
    .leftJoin('RawProduct as rp', 'fp.product_id', 'rp.product_id')
    .select(
      'fp.product_id',
      'fp.population',
      'fp.population_unit',
      'rp.product_name',
      'rp.product_type',
      'rp.grade'
    )
    .where('fp.farm_id', farmId)
    .orderBy('rp.product_name', 'asc')
  if (productId) {
    query.andWhere('fp.product_id', productId)
  }
  const rows = await query
  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name || `Product #${row.product_id}`,
    productType: row.product_type || null,
    grade: row.grade || null,
    population: row.population != null ? Number(row.population) : null,
    populationUnit: row.population_unit || null
  }))
}

async function fetchInventoryRows(farmId: number, productId?: number | null) {
  const query = knex('Inventory as inv')
    .leftJoin('RawProduct as rp', 'inv.product_id', 'rp.product_id')
    .select('inv.batch_id', 'inv.product_id', 'inv.farm_id', 'inv.price', 'inv.weight', 'inv.quantity', 'inv.exp_date', 'rp.product_name')
    .where('inv.farm_id', farmId)
    .orderBy('inv.exp_date', 'desc')
  if (productId) {
    query.andWhere('inv.product_id', productId)
  }
  const rows = await query
  return rows.map((row) => ({
    batchId: row.batch_id,
    productId: row.product_id,
    farmId: row.farm_id,
    price: row.price != null ? Number(row.price) : null,
    weight: row.weight != null ? Number(row.weight) : null,
    quantity: row.quantity != null ? Number(row.quantity) : null,
    expDate: toISODate(row.exp_date),
    productName: row.product_name || `Product #${row.product_id}`
  }))
}

export async function generateSubscriptionClientsReportForFarm(farmId: number, filters: SubscriptionReportFilters) {
  const farm = await fetchFarmContext(farmId)
  if (!farm) {
    throw httpError(404, 'Farm not found.')
  }
  const [subscriptions, offerings, inventory] = await Promise.all([
    fetchSubscriptionRows(farmId, filters),
    fetchOfferingRows(farmId, filters.productId),
    fetchInventoryRows(farmId, filters.productId)
  ])
  return buildReportSnapshot({
    farm,
    filters,
    subscriptions,
    offerings,
    inventory
  })
}

interface ReportBuilderPayload {
  farm: FarmContext
  filters: SubscriptionReportFilters
  subscriptions: Array<{
    programId: number
    productId: number
    farmId: number
    clientId: number
    clientName: string
    companyName: string | null
    startDate: string | null
    quantity: number | null
    intervalDays: number | null
    price: number | null
    status: string
    productName: string
    productType: string | null
    grade: string | null
    locationLabel: string | null
  }>
  offerings: Array<{
    productId: number
    productName: string
    productType: string | null
    grade: string | null
    population: number | null
    populationUnit: string | null
  }>
  inventory: Array<{
    productId: number
    price: number | null
    weight: number | null
    quantity: number | null
  }>
}

function average(values: number[]): number | null {
  const filtered = values.filter((value) => Number.isFinite(value))
  if (!filtered.length) return null
  const sum = filtered.reduce((acc, value) => acc + value, 0)
  return Number((sum / filtered.length).toFixed(2))
}

function buildInventoryLookup(rows: ReportBuilderPayload['inventory']) {
  const map = new Map<number, { unitPrices: number[]; availableUnits: number }>()
  rows.forEach((row) => {
    if (row.price == null || row.weight == null || row.weight <= 0) return
    const entry = map.get(row.productId) || { unitPrices: [], availableUnits: 0 }
    entry.unitPrices.push(row.price / row.weight)
    entry.availableUnits += Number(row.quantity || 0)
    map.set(row.productId, entry)
  })
  const result = new Map<number, { avgPrice: number | null; availableUnits: number }>()
  map.forEach((value, key) => {
    result.set(key, {
      avgPrice: average(value.unitPrices),
      availableUnits: value.availableUnits
    })
  })
  return result
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled',
  QUOTED: 'Quoted',
  AWAITING_QUOTE: 'Awaiting quote'
}

function buildReportSnapshot(payload: ReportBuilderPayload) {
  const inventoryLookup = buildInventoryLookup(payload.inventory)
  const offeringMap = new Map<number, any>()
  payload.offerings.forEach((offering) => {
    offeringMap.set(offering.productId, {
      productId: offering.productId,
      productName: offering.productName,
      productType: offering.productType,
      grade: offering.grade,
      population: offering.population,
      populationUnit: offering.populationUnit,
      subscriptions: [],
      clientIds: new Set<number>(),
      activeCount: 0,
      cancelledCount: 0,
      awaitingCount: 0,
      priceSamples: [] as number[],
      intervalSamples: [] as number[],
      quantitySamples: [] as number[],
      monthlyRevenueSamples: [] as number[]
    })
  })

  payload.subscriptions.forEach((sub) => {
    if (!offeringMap.has(sub.productId)) {
      offeringMap.set(sub.productId, {
        productId: sub.productId,
        productName: sub.productName,
        productType: sub.productType,
        grade: sub.grade,
        population: null,
        populationUnit: null,
        subscriptions: [],
        clientIds: new Set<number>(),
        activeCount: 0,
        cancelledCount: 0,
        awaitingCount: 0,
        priceSamples: [] as number[],
        intervalSamples: [] as number[],
        quantitySamples: [] as number[],
        monthlyRevenueSamples: [] as number[]
      })
    }
    const bucket = offeringMap.get(sub.productId)
    bucket.subscriptions.push(sub)
    bucket.clientIds.add(sub.clientId)
    const status = (sub.status || '').toUpperCase()
    if (status === 'ACTIVE') {
      bucket.activeCount += 1
    } else if (status === 'CANCELLED') {
      bucket.cancelledCount += 1
    } else {
      bucket.awaitingCount += 1
    }
    if (typeof sub.price === 'number') {
      bucket.priceSamples.push(sub.price)
    }
    if (typeof sub.quantity === 'number') {
      bucket.quantitySamples.push(sub.quantity)
    }
    if (typeof sub.intervalDays === 'number') {
      bucket.intervalSamples.push(sub.intervalDays)
      if (sub.price != null && sub.intervalDays > 0) {
        bucket.monthlyRevenueSamples.push((30 / sub.intervalDays) * sub.price)
      }
    }
  })

  const offerings = Array.from(offeringMap.values()).map((entry) => {
    const averageSubscriptionPrice = average(entry.priceSamples)
    const averageIntervalDays = average(entry.intervalSamples)
    const averageQuantity = average(entry.quantitySamples)
    const projectedMonthlyRevenue = average(entry.monthlyRevenueSamples)
    const inventoryStats = inventoryLookup.get(entry.productId)
    const onDemandUnitPrice = inventoryStats?.avgPrice ?? null
    const priceDelta = averageSubscriptionPrice != null && onDemandUnitPrice != null
      ? Number((averageSubscriptionPrice - onDemandUnitPrice).toFixed(2))
      : null
    const totalPrograms = entry.subscriptions.length
    const churnRate = totalPrograms
      ? Number(((entry.cancelledCount / totalPrograms) * 100).toFixed(1))
      : null
    return {
      productId: entry.productId,
      productName: entry.productName,
      productType: entry.productType,
      grade: entry.grade,
      population: entry.population,
      populationUnit: entry.populationUnit,
      activeCount: entry.activeCount,
      cancelledCount: entry.cancelledCount,
      awaitingCount: entry.awaitingCount,
      totalPrograms,
      uniqueClients: entry.clientIds.size,
      averageSubscriptionPrice,
      averageIntervalDays,
      averageQuantity,
      projectedMonthlyRevenue,
      onDemandUnitPrice,
      priceDelta,
      priceDeltaPercent: priceDelta != null && onDemandUnitPrice
        ? Number(((priceDelta / onDemandUnitPrice) * 100).toFixed(1))
        : null,
      availableUnits: inventoryStats?.availableUnits ?? 0,
      churnRate,
      clients: entry.subscriptions.map((sub: any) => ({
        programId: sub.programId,
        clientId: sub.clientId,
        clientName: sub.clientName,
        companyName: sub.companyName,
        startDate: sub.startDate,
        status: sub.status,
        statusLabel: STATUS_LABELS[(sub.status || '').toUpperCase()] || sub.status || 'Unknown',
        price: sub.price,
        quantity: sub.quantity,
        intervalDays: sub.intervalDays
      }))
    }
  }).sort((a, b) => b.activeCount - a.activeCount || a.productName.localeCompare(b.productName))

  const totalPrograms = offerings.reduce((sum, entry) => sum + entry.totalPrograms, 0)
  const uniqueClients = new Set<number>()
  offerings.forEach((entry) => entry.clients.forEach((client: any) => uniqueClients.add(client.clientId)))
  const summary = {
    totalPrograms,
    uniqueClients: uniqueClients.size,
    activePrograms: offerings.reduce((sum, entry) => sum + entry.activeCount, 0),
    cancelledPrograms: offerings.reduce((sum, entry) => sum + entry.cancelledCount, 0),
    offeringCoverage: offerings.filter((entry) => entry.totalPrograms > 0).length,
    reportWindow: {
      from: payload.filters.startDateFrom,
      to: payload.filters.startDateTo
    }
  }

  const chartData = {
    labels: offerings.map((entry) => entry.productName),
    active: offerings.map((entry) => entry.activeCount),
    cancelled: offerings.map((entry) => entry.cancelledCount),
    avgSubscriptionPrice: offerings.map((entry) => entry.averageSubscriptionPrice || 0),
    avgOnDemandPrice: offerings.map((entry) => entry.onDemandUnitPrice || 0)
  }

  return {
    generatedAt: new Date().toISOString(),
    filters: payload.filters,
    farm: payload.farm,
    offerings,
    summary,
    chartData
  }
}
