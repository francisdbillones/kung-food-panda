const SUBSCRIPTIONS_ENDPOINT = '/api/customer/subscriptions'
const PRODUCT_OFFERS_ENDPOINT = '/api/customer/subscriptions/offers'
const CREATE_SUBSCRIPTION_ENDPOINT = '/api/customer/subscriptions'
const LOCATION_ENDPOINT = '/api/customer/locations'

const selectors = {
  alert: '[data-request-alert]',
  form: '[data-request-form]',
  productSelect: '[data-product-select]',
  farmSelect: '[data-farm-select]',
  scheduleSelect: '[data-schedule-select]',
  customScheduleWrapper: '[data-custom-schedule]',
  customScheduleInput: '[data-custom-schedule-input]',
  quantityInput: '[data-quantity]',
  startInput: '[data-start]',
  submitButton: '[data-request-form] button[type="submit"]',
  defaultLocation: '[data-request-default-location]',
  locationOptions: '[data-request-location-option]',
  customFields: '[data-request-custom-fields]',
  customStreet: '[data-request-street]',
  customCity: '[data-request-city]',
  customState: '[data-request-state]',
  customCountry: '[data-request-country]',
  feedback: '[data-request-feedback]'
}

const state = {
  products: [],
  offers: [],
  selectedProductId: null,
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

function setFeedback(message, isSuccess = false) {
  const el = $(selectors.feedback)
  if (!el) return
  el.textContent = message || ''
  el.classList.toggle('success', Boolean(isSuccess))
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

function populateProducts(products) {
  const select = $(selectors.productSelect)
  if (!select) return
  select.innerHTML = ''
  if (!products.length) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'No products available'
    select.appendChild(option)
    select.disabled = true
    return
  }
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = 'Select a product'
  select.appendChild(placeholder)
  products.forEach((product) => {
    const option = document.createElement('option')
    option.value = product.productId
    option.textContent = `${product.productName} (${product.productType || 'N/A'})`
    select.appendChild(option)
  })
  select.disabled = false
}

function populateFarms(offers) {
  const select = $(selectors.farmSelect)
  if (!select) return
  select.innerHTML = ''
  if (!offers.length) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'No farms available for this product'
    select.appendChild(option)
    select.disabled = true
    return
  }
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = 'Select a farm'
  select.appendChild(placeholder)
  offers.forEach((offer) => {
    const option = document.createElement('option')
    option.value = offer.farmId
    option.textContent = `Farm #${offer.farmId} · ${offer.locationLabel}`
    select.appendChild(option)
  })
  select.disabled = false
}

function populateSchedules(offer) {
  const select = $(selectors.scheduleSelect)
  const customWrapper = $(selectors.customScheduleWrapper)
  if (!select) return
  select.innerHTML = ''
  if (!offer || !offer.standardSchedules || offer.standardSchedules.length === 0) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'Contact farm for schedules'
    select.appendChild(option)
    select.disabled = true
    if (customWrapper) customWrapper.hidden = true
    return
  }
  offer.standardSchedules.forEach((days) => {
    const option = document.createElement('option')
    option.value = days
    option.textContent = `${days} days`
    select.appendChild(option)
  })
  const customOption = document.createElement('option')
  customOption.value = 'custom'
  customOption.textContent = 'Custom interval…'
  select.appendChild(customOption)
  select.disabled = false
  if (customWrapper) customWrapper.hidden = select.value !== 'custom'
}

function handleScheduleChange(event) {
  const customWrapper = $(selectors.customScheduleWrapper)
  if (!customWrapper) return
  customWrapper.hidden = event.target.value !== 'custom'
  const customInput = $(selectors.customScheduleInput)
  if (customInput) {
    customInput.disabled = event.target.value !== 'custom'
    if (!customInput.disabled && !customInput.value) {
      customInput.value = '30'
    }
  }
}

function enableInputs() {
  const quantity = $(selectors.quantityInput)
  const start = $(selectors.startInput)
  const submit = $(selectors.submitButton)
  if (quantity) quantity.disabled = false
  if (start) {
    start.disabled = false
    if (!start.value) {
      start.value = new Date().toISOString().split('T')[0]
    }
  }
  if (submit) submit.disabled = false
}

function getOfferByFarmId(farmId) {
  return state.offers.find((offer) => offer.farmId === Number(farmId))
}

function handleProductChange(event) {
  const productId = Number(event.target.value)
  state.selectedProductId = Number.isNaN(productId) ? null : productId
  const schedule = $(selectors.scheduleSelect)
  const farmSelect = $(selectors.farmSelect)
  if (schedule) {
    schedule.innerHTML = '<option value="">Select a farm first</option>'
    schedule.disabled = true
  }
  if (farmSelect) {
    farmSelect.innerHTML = '<option value="">Loading farms…</option>'
    farmSelect.disabled = true
  }
  const submit = $(selectors.submitButton)
  if (submit) submit.disabled = true
  const quantity = $(selectors.quantityInput)
  if (quantity) quantity.disabled = true
  const start = $(selectors.startInput)
  if (start) start.disabled = true
  if (!state.selectedProductId) {
    populateFarms([])
    state.offers = []
    return
  }
  loadOffers(state.selectedProductId)
}

function handleFarmChange(event) {
  const farmId = Number(event.target.value)
  if (!farmId) {
    populateSchedules(null)
    const submit = $(selectors.submitButton)
    if (submit) submit.disabled = true
    return
  }
  const offer = getOfferByFarmId(farmId)
  populateSchedules(offer)
  enableInputs()
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

async function createCustomLocation(payload) {
  const response = await fetch(LOCATION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  })
  if (response.status === 401) {
    window.location.href = '/login-customer.html'
    return null
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Failed to save address.')
  }
  return data.location
}

async function resolveLocationId() {
  if (state.locationMode === 'custom') {
    const payload = validateCustomLocation()
    const location = await createCustomLocation(payload)
    return location?.locationId
  }
  return state.defaultLocation?.locationId || null
}

function serializeRequest() {
  const scheduleSelect = $(selectors.scheduleSelect)
  const customInput = $(selectors.customScheduleInput)
  const scheduleValue = scheduleSelect?.value
  let intervalDays
  if (scheduleValue === 'custom') {
    const customDays = Number(customInput?.value)
    if (!customDays || customDays <= 0) {
      throw new Error('Enter a valid custom interval (in days).')
    }
    intervalDays = customDays
  } else {
    intervalDays = Number(scheduleValue)
    if (!intervalDays || intervalDays <= 0) {
      throw new Error('Select a delivery schedule.')
    }
  }

  const quantity = $(selectors.quantityInput)?.value
  const startDate = $(selectors.startInput)?.value
  if (!quantity || Number(quantity) <= 0) {
    throw new Error('Quantity must be greater than zero.')
  }
  if (!startDate) {
    throw new Error('Choose a start date.')
  }
  return {
    intervalDays,
    quantity: Number(quantity),
    startDate
  }
}

async function handleSubmit(event) {
  event.preventDefault()
  const farmId = Number($(selectors.farmSelect)?.value)
  if (!state.selectedProductId || !farmId) {
    setFeedback('Select a product and farm before submitting.')
    return
  }
  try {
    setFeedback('Submitting request…', true)
    const locationId = await resolveLocationId()
    if (!locationId) {
      throw new Error('Please provide a delivery location.')
    }
    const requestPayload = serializeRequest()
    const payload = {
      productId: state.selectedProductId,
      farmId,
      locationId,
      ...requestPayload
    }
    const response = await fetch(CREATE_SUBSCRIPTION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (response.status === 401) {
      window.location.href = '/login-customer.html'
      return
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || 'Unable to create subscription request.')
    }
    setFeedback('Quote request sent! Redirecting…', true)
    setTimeout(() => {
      window.location.href = '/customer-subscribe.html'
    }, 800)
  } catch (error) {
    console.error('Request submission error', error)
    setFeedback(error.message || 'Unable to submit request.', false)
  }
}

async function loadProductsAndLocation() {
  setAlert('Loading products…', true)
  const response = await fetch(SUBSCRIPTIONS_ENDPOINT, { credentials: 'include' })
  if (response.status === 401) {
    window.location.href = '/login-customer.html'
    return
  }
  if (!response.ok) {
    throw new Error('Unable to load available products.')
  }
  const data = await response.json()
  state.products = data.availableProducts || []
  state.defaultLocation = data.location || null
  populateProducts(state.products)
  setText(selectors.defaultLocation, state.defaultLocation?.label || 'No default location set')
  setAlert('Select a product to continue.', true)
}

async function loadOffers(productId) {
  try {
    setAlert('Loading farms…', true)
    const response = await fetch(`${PRODUCT_OFFERS_ENDPOINT}?productId=${productId}`, { credentials: 'include' })
    if (response.status === 401) {
      window.location.href = '/login-customer.html'
      return
    }
    if (!response.ok) {
      throw new Error('Unable to load farms for this product.')
    }
    const data = await response.json()
    state.offers = data.offers || []
    populateFarms(state.offers)
    setAlert(state.offers.length ? 'Select a farm to continue.' : 'No farms currently offer this product.', Boolean(state.offers.length))
  } catch (error) {
    console.error('Offer load error', error)
    setAlert(error.message || 'Unable to load farms.', false)
    populateFarms([])
  }
}

function initEvents() {
  const form = $(selectors.form)
  if (form) {
    form.addEventListener('submit', handleSubmit)
  }
  const productSelect = $(selectors.productSelect)
  if (productSelect) {
    productSelect.addEventListener('change', handleProductChange)
  }
  const farmSelect = $(selectors.farmSelect)
  if (farmSelect) {
    farmSelect.addEventListener('change', handleFarmChange)
  }
  const scheduleSelect = $(selectors.scheduleSelect)
  if (scheduleSelect) {
    scheduleSelect.addEventListener('change', handleScheduleChange)
  }
  document.querySelectorAll(selectors.locationOptions).forEach((radio) => {
    radio.addEventListener('change', (event) => {
      if (event.target.checked) {
        setLocationMode(event.target.value === 'custom' ? 'custom' : 'default')
      }
    })
  })
}

async function initPage() {
  try {
    setLocationMode('default')
    resetCustomLocation()
    initEvents()
    await loadProductsAndLocation()
  } catch (error) {
    console.error('Initialization error', error)
    setAlert(error.message || 'Unable to load request form.', false)
  }
}

document.addEventListener('DOMContentLoaded', initPage)
