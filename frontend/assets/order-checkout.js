const ORDER_OPTIONS_ENDPOINT = '/api/customer/orders/options'
const ORDER_BATCH_ENDPOINT = '/api/customer/orders/batch'
const CREATE_ORDER_ENDPOINT = '/api/customer/orders'
const LOCATION_ENDPOINT = '/api/customer/locations'

const selectors = {
  alert: '[data-checkout-alert]',
  form: '[data-checkout-form]',
  quantityInput: '[data-checkout-quantity]',
  quantityHint: '[data-checkout-quantity-hint]',
  deliveryDate: '[data-checkout-date]',
  loyaltyInput: '[data-checkout-loyalty]',
  summarySubtotal: '[data-checkout-subtotal]',
  summaryDiscount: '[data-checkout-discount]',
  summaryTotal: '[data-checkout-total]',
  summaryPoints: '[data-checkout-points]',
  defaultLocation: '[data-checkout-default-location]',
  locationOptions: '[data-checkout-location-option]',
  customFields: '[data-checkout-custom-fields]',
  customStreet: '[data-checkout-street]',
  customCity: '[data-checkout-city]',
  customState: '[data-checkout-state]',
  customCountry: '[data-checkout-country]'
}

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
})

const weightFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})

const state = {
  batch: null,
  loyaltyPoints: 0,
  defaultLocation: null,
  locationMode: 'default'
}

function $(selector) {
  return document.querySelector(selector)
}

function setText(selector, value) {
  const el = $(selector)
  if (el) el.textContent = value
}

function setAlert(message, isSuccess = false) {
  const el = $(selectors.alert)
  if (!el) return
  el.textContent = message || ''
  el.classList.toggle('success', Boolean(isSuccess))
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0)
}

function formatUnitWeight(value, fallback = 'Weight TBD') {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return `${weightFormatter.format(number)} kg/unit`
}

function setLocationMode(mode) {
  state.locationMode = mode
  const customFields = $(selectors.customFields)
  if (customFields) customFields.hidden = mode !== 'custom'
  ;[selectors.customStreet, selectors.customCity, selectors.customState, selectors.customCountry].forEach((selector) => {
    const input = $(selector)
    if (input) input.disabled = mode !== 'custom'
  })
}

function resetCustomLocation() {
  const street = $(selectors.customStreet)
  const city = $(selectors.customCity)
  const stateInput = $(selectors.customState)
  const country = $(selectors.customCountry)
  if (street) street.value = ''
  if (city) city.value = ''
  if (stateInput) stateInput.value = ''
  if (country) country.value = 'Philippines'
}

function updateSummary() {
  if (!state.batch) return
  const quantity = Number($(selectors.quantityInput)?.value) || 0
  const loyaltyUse = Math.max(0, Number($(selectors.loyaltyInput)?.value) || 0)
  const price = Number(state.batch.price) || 0
  const subtotal = price * quantity
  const maxDiscount = Math.min(subtotal, state.loyaltyPoints)
  const discount = Math.min(loyaltyUse, maxDiscount)
  const total = Math.max(0, subtotal - discount)
  const pointsEarned = Math.floor(total / 100)
  setText(selectors.summarySubtotal, formatCurrency(subtotal))
  setText(selectors.summaryDiscount, `-${formatCurrency(discount)}`)
  setText(selectors.summaryTotal, formatCurrency(total))
  setText(selectors.summaryPoints, `${pointsEarned} pts`)
  const loyaltyInput = $(selectors.loyaltyInput)
  if (loyaltyInput) loyaltyInput.max = maxDiscount.toFixed(0)
}

function populateBatchDetails(batch, profile, location) {
  state.batch = batch
  state.loyaltyPoints = Number(profile?.loyaltyPoints) || 0
  state.defaultLocation = location || null
  setText('[data-batch-product]', batch.productName)
  setText('[data-batch-farm]', `#${batch.farmId}`)
  setText('[data-batch-location]', batch.farmLocation || 'Location TBD')
  setText('[data-batch-price]', formatCurrency(batch.price))
  setText('[data-batch-weight]', formatUnitWeight(batch.weight))
  setText('[data-batch-available]', batch.quantity)
  setText('[data-batch-exp]', batch.expDate || '—')
  setText(selectors.defaultLocation, state.defaultLocation?.label || 'No default location set')
  const quantityInput = $(selectors.quantityInput)
  if (quantityInput) {
    quantityInput.max = batch.quantity
    quantityInput.value = Math.min(batch.quantity, Number(quantityInput.value) || 1)
  }
  const hint = $(selectors.quantityHint)
  if (hint) hint.textContent = `Up to ${batch.quantity} units available (${formatUnitWeight(batch.weight)}).`
  const loyaltyInput = $(selectors.loyaltyInput)
  if (loyaltyInput) loyaltyInput.value = '0'
  updateSummary()
}

async function createCustomLocation(payload) {
  const response = await fetch(LOCATION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  })
  if (response.status === 401) {
    window.location.href = '/login.html#customer'
    return null
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Failed to save address.')
  }
  return data.location
}

function validateCustomLocation() {
  const street = $(selectors.customStreet)?.value?.trim()
  const city = $(selectors.customCity)?.value?.trim()
  const stateValue = $(selectors.customState)?.value?.trim() || null
  const country = $(selectors.customCountry)?.value?.trim() || 'Philippines'
  if (!street || !city) {
    throw new Error('Custom address requires both street and city.')
  }
  return { street, city, state: stateValue, country, continent: 'Asia' }
}

async function resolveLocationId() {
  if (state.locationMode === 'custom') {
    const payload = validateCustomLocation()
    const location = await createCustomLocation(payload)
    return location?.locationId
  }
  return state.defaultLocation?.locationId || null
}

function serializeOrder() {
  if (!state.batch) {
    throw new Error('Batch not loaded.')
  }
  const quantity = Number($(selectors.quantityInput)?.value)
  if (!quantity || quantity <= 0) {
    throw new Error('Quantity must be greater than zero.')
  }
  if (quantity > state.batch.quantity) {
    throw new Error('Requested quantity exceeds available stock.')
  }
  const deliveryDate = $(selectors.deliveryDate)?.value
  if (!deliveryDate) {
    throw new Error('Choose a delivery date.')
  }
  const loyaltyUse = Math.max(0, Number($(selectors.loyaltyInput)?.value) || 0)
  return {
    batchId: state.batch.batchId,
    quantity,
    deliveryDate,
    loyaltyUse
  }
}

async function handleSubmit(event) {
  event.preventDefault()
  try {
    setAlert('Submitting order…', true)
    const locationId = await resolveLocationId()
    if (!locationId) {
      throw new Error('Please provide a delivery location.')
    }
    const orderPayload = serializeOrder()
    const response = await fetch(CREATE_ORDER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...orderPayload, locationId })
    })
    if (response.status === 401) {
      window.location.href = '/login.html#customer'
      return
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || 'Unable to place order.')
    }
    setAlert('Order placed! Redirecting to catalog…', true)
    setTimeout(() => {
      window.location.href = '/customer-order.html'
    }, 1200)
  } catch (error) {
    console.error('Checkout error', error)
    setAlert(error.message || 'Unable to place order.', false)
  }
}

async function loadBatch(batchId) {
  try {
    setAlert('Loading batch…', true)
    const response = await fetch(`${ORDER_BATCH_ENDPOINT}?batchId=${batchId}`, { credentials: 'include' })
    if (response.status === 401) {
      window.location.href = '/login.html#customer'
      return
    }
    if (!response.ok) {
      throw new Error('Batch not found.')
    }
    const data = await response.json()
    populateBatchDetails(data.batch, data.profile, data.location)
    setAlert('Batch ready. Fill in your details.', true)
  } catch (error) {
    console.error('Batch load error', error)
    setAlert(error.message || 'Unable to load batch.', false)
  }
}

function getBatchId() {
  const params = new URLSearchParams(window.location.search)
  const batchId = Number(params.get('batchId'))
  return Number.isNaN(batchId) ? null : batchId
}

function initEvents() {
  const form = $(selectors.form)
  if (form) form.addEventListener('submit', handleSubmit)
  const quantity = $(selectors.quantityInput)
  if (quantity) quantity.addEventListener('input', updateSummary)
  const loyaltyInput = $(selectors.loyaltyInput)
  if (loyaltyInput) loyaltyInput.addEventListener('input', updateSummary)
  const deliveryDate = $(selectors.deliveryDate)
  if (deliveryDate) {
    const today = new Date().toISOString().split('T')[0]
    deliveryDate.min = today
  }
  document.querySelectorAll(selectors.locationOptions).forEach((radio) => {
    radio.addEventListener('change', (event) => {
      if (event.target.checked) {
        setLocationMode(event.target.value === 'custom' ? 'custom' : 'default')
      }
    })
  })
}

function initPage() {
  const batchId = getBatchId()
  if (!batchId) {
    setAlert('No batch selected.')
    return
  }
  setLocationMode('default')
  resetCustomLocation()
  initEvents()
  loadBatch(batchId)
}

document.addEventListener('DOMContentLoaded', initPage)
