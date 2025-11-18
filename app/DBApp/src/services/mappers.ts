import { normalizeDateOnly, toISODate, computeNextDeliveryDate } from '../lib/dates'
import { formatLocationLabel } from '../lib/locations'

export function mapOrderRow(row: any) {
  const quantity = Number(row.quantity) || 0
  const unitPrice = row.unit_price == null ? null : Number(row.unit_price)
  const loyaltyDiscount = Number(row.loyalty_points_used) || 0
  const grossAmount = unitPrice == null ? null : Number((unitPrice * quantity).toFixed(2))
  const totalAmount = grossAmount == null
    ? null
    : Number(Math.max(0, grossAmount - loyaltyDiscount).toFixed(2))
  const shippedDate = toISODate(row.shipped_date)
  const dueDate = row.due_by ? normalizeDateOnly(row.due_by) : null
  const today = normalizeDateOnly(new Date())
  let status = 'Pending fulfillment'
  let statusVariant = 'pending'
  if (shippedDate) {
    status = 'Shipped'
    statusVariant = 'success'
  } else if (dueDate && today && dueDate < today) {
    status = 'Overdue'
    statusVariant = 'danger'
  } else if (dueDate && today && dueDate.getTime() === today.getTime()) {
    status = 'Due today'
    statusVariant = 'pending'
  }
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
    status,
    statusVariant,
    farmId: row.farm_id || null,
    farmName: row.farm_name || null,
    productGrade: row.grade || null
  }
}

export function mapSubscriptionRow(row: any) {
  const intervalDays = Number(row.order_interval_days) || null
  const nextDelivery = computeNextDeliveryDate(row.start_date, intervalDays)
  const locationParts = [row.city, row.state, row.country].filter(Boolean)
  return {
    programId: row.program_id,
    productId: row.product_id,
    farmId: row.farm_id || null,
    farmName: row.farm_name || null,
    productGrade: row.grade || null,
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

export function mapProductRow(row: any) {
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

export function mapInventoryRow(row: any) {
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

export function mapProductDetail(row: any) {
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

export function mapLocationRow(row: any) {
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

export function mapFarmOffer(row: any) {
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

export function mapFarmRow(row: any) {
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

export function mapFarmerOrderRow(row: any) {
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
    batchId: row.batch_id,
    productId: row.product_id,
    productName: row.product_name || `Batch #${row.batch_id}`,
    quantity,
    unitPrice,
    totalAmount,
    orderDate: toISODate(row.order_date),
    dueBy: toISODate(row.due_by),
    shippedDate: toISODate(row.shipped_date),
    isShipped: Boolean(row.shipped_date),
    status: row.shipped_date ? 'Shipped' : 'Pending',
    clientLabel,
    shipTo,
    notes: row.notes || null
  }
}

export function mapFarmerSubscriptionRow(row: any) {
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

export function mapFarmOfferingRow(row: any) {
  return {
    productId: row.product_id,
    farmId: row.farm_id,
    productName: row.product_name,
    productType: row.product_type,
    grade: row.grade,
    population: Number(row.population) || 0
  }
}

export function mapRawProductLite(row: any) {
  return {
    productId: row.product_id,
    productName: row.product_name,
    productType: row.product_type,
    grade: row.grade,
    seasonStart: toISODate(row.start_season),
    seasonEnd: toISODate(row.end_season)
  }
}
