import { IncomingMessage, ServerResponse } from 'http'
import { readBody, sendJson } from '../lib/http'
import { httpError } from '../lib/errors'
import { normalizeDateOnly, toISODate } from '../lib/dates'
import { requireSession } from '../services/sessionService'
import {
  generateSubscriptionClientsReportForFarm,
  listAdminReportFarms,
  listFarmerReportProducts,
  listProductsForFarms,
  type SubscriptionReportFilters
} from '../services/reportService'
import {
  runFarmerReportPdf,
  runFarmerOrderSalesReportPdf,
  runAdminLoyaltyReportPdf,
  runAdminProductivityReportPdf,
  runAdminProductSalesReportPdf
} from '../services/reportRunner'

const REPORT_DEFINITIONS = [
  {
    id: 'subscriptionClients',
    target: 'farmer',
    title: 'Subscription clients per offering',
    description: 'Break down clients by product, compare subscription pricing versus on-demand inventory, and monitor churn per product.',
    filters: {
      requiresDateRange: true,
      supportsProductFilter: true
    }
  },
  {
    id: 'orderSales',
    target: 'farmer',
    title: 'On-demand order sales',
    description: 'Track non-subscription orders to see which offerings drive volume and revenue.',
    filters: {
      requiresDateRange: true,
      supportsProductFilter: false
    }
  },
  {
    id: 'loyaltyEngagement',
    target: 'admin',
    title: 'Customer loyalty engagement',
    description: 'Monitor loyalty point accumulation versus redemption to gauge customer activity.',
    filters: {
      requiresDateRange: true,
      supportsProductFilter: false
    }
  },
  {
    id: 'farmProductivity',
    target: 'admin',
    title: 'Farm productivity vs inventory',
    description: 'Compare declared populations with on-hand inventory per farm to spot low-yield operations.',
    filters: {
      requiresDateRange: true,
      supportsProductFilter: false
    }
  },
  {
    id: 'productSales',
    target: 'admin',
    title: 'Product sales by type',
    description: 'Track monthly sales (units & revenue) per product type and annual revenue mix across farms.',
    filters: {
      requiresDateRange: true,
      supportsProductFilter: false
    }
  }
] as const

function normalizeFilterDate(value: unknown, label: string): string {
  const date = normalizeDateOnly(value)
  if (!date || Number.isNaN(date.getTime())) {
    throw httpError(400, `Enter a valid ${label}.`)
  }
  const iso = toISODate(date)
  if (!iso) {
    throw httpError(400, `Enter a valid ${label}.`)
  }
  return iso
}

function validateDateRange(body: any): Pick<SubscriptionReportFilters, 'startDateFrom' | 'startDateTo'> {
  const startDateFrom = normalizeFilterDate(body.startDateFrom || body.from, 'start date (from)')
  const startDateTo = normalizeFilterDate(body.startDateTo || body.to, 'start date (to)')
  if (startDateFrom > startDateTo) {
    throw httpError(400, 'Start date must be before the end date.')
  }
  return { startDateFrom, startDateTo }
}

function normalizeProductId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    throw httpError(400, 'Enter a valid product.')
  }
  return numeric
}

export async function handleFarmerReportsList(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
  try {
    const [products] = await Promise.all([
      listFarmerReportProducts(farmId)
    ])
    sendJson(response, 200, {
      line: 'Farmer reports ready.',
      reports: REPORT_DEFINITIONS.filter((report) => report.target === 'farmer'),
      options: {
        products
      }
    })
  } catch (error) {
    console.error('Farmer reports overview error', error)
    sendJson(response, 500, { error: 'Unable to load farmer reports.' })
  }
}

export async function handleFarmerSubscriptionReport(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
  try {
    const body = await readBody<any>(request)
    const { startDateFrom, startDateTo } = validateDateRange(body)
    const productId = normalizeProductId(body.productId)
    const report = await generateSubscriptionClientsReportForFarm(farmId, {
      startDateFrom,
      startDateTo,
      productId
    })
    sendJson(response, 200, {
      line: 'Subscription client report ready.',
      report
    })
  } catch (error: any) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
      return
    }
    console.error('Farmer subscription report error', error)
    sendJson(response, 500, { error: 'Unable to generate the report.' })
  }
}

export async function handleAdminReportsList(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const farms = await listAdminReportFarms()
    const farmIds = farms.map((farm) => farm.farmId)
    const productMap = await listProductsForFarms(farmIds)
    sendJson(response, 200, {
      line: 'Admin reports ready.',
      reports: REPORT_DEFINITIONS.filter((report) => report.target === 'admin'),
      options: {
        farms,
        productsByFarm: productMap
      }
    })
  } catch (error) {
    console.error('Admin reports overview error', error)
    sendJson(response, 500, { error: 'Unable to load admin reports.' })
  }
}

export async function handleAdminSubscriptionReport(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const body = await readBody<any>(request)
    const farmId = Number(body.farmId)
    if (!farmId || Number.isNaN(farmId)) {
      throw httpError(400, 'Select a farm before running the report.')
    }
    const { startDateFrom, startDateTo } = validateDateRange(body)
    const productId = normalizeProductId(body.productId)
    const report = await generateSubscriptionClientsReportForFarm(farmId, {
      startDateFrom,
      startDateTo,
      productId
    })
    sendJson(response, 200, {
      line: 'Subscription client report ready.',
      report
    })
  } catch (error: any) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
      return
    }
    console.error('Admin subscription report error', error)
    sendJson(response, 500, { error: 'Unable to generate the report.' })
  }
}

export async function handleAdminReportPdf(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'admin')
  if (!session) return
  try {
    const body = await readBody<any>(request)
    const { startDateFrom, startDateTo } = validateDateRange(body)
    const reportId = body.reportId
    if (reportId === 'loyaltyEngagement') {
      const result = await runAdminLoyaltyReportPdf({
        startDateFrom,
        startDateTo
      })
      sendJson(response, 200, {
        line: 'PDF report generated.',
        url: result.publicUrl
      })
      return
      return
    }
    if (reportId === 'farmProductivity') {
      const result = await runAdminProductivityReportPdf({
        startDateFrom,
        startDateTo
      })
      sendJson(response, 200, {
        line: 'PDF report generated.',
        url: result.publicUrl
      })
      return
    }
    if (reportId === 'productSales') {
      const result = await runAdminProductSalesReportPdf({
        startDateFrom,
        startDateTo
      })
      sendJson(response, 200, {
        line: 'PDF report generated.',
        url: result.publicUrl
      })
      return
    }
    sendJson(response, 400, { error: 'Unknown admin report.' })
  } catch (error: any) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
      return
    }
    console.error('Admin report pdf error', error)
    sendJson(response, 500, { error: 'Unable to generate the report.' })
  }
}

export async function handleFarmerReportPdf(request: IncomingMessage, response: ServerResponse) {
  const session = await requireSession(request, response, 'farmer')
  if (!session) return
  const farmId = Number(session.data.farmId)
  try {
    const body = await readBody<any>(request)
    const { startDateFrom, startDateTo } = validateDateRange(body)
    const reportId = body.reportId || 'subscriptionClients'
    if (reportId === 'orderSales') {
      const result = await runFarmerOrderSalesReportPdf({
        farmId,
        startDateFrom,
        startDateTo
      })
      sendJson(response, 200, {
        line: 'PDF report generated.',
        url: result.publicUrl
      })
      return
    }
    const productId = normalizeProductId(body.productId)
    const result = await runFarmerReportPdf({
      farmId,
      startDateFrom,
      startDateTo,
      productId
    })
    sendJson(response, 200, {
      line: 'PDF report generated.',
      url: result.publicUrl
    })
  } catch (error: any) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
      return
    }
    console.error('Farmer report PDF error', error)
    sendJson(response, 500, { error: 'Unable to generate the PDF report.' })
  }
}
