const PRODUCT_OFFERS_ENDPOINT = '/api/customer/subscriptions/offers'
const CREATE_SUBSCRIPTION_ENDPOINT = '/api/customer/subscriptions'
const LOCATION_ENDPOINT = '/api/customer/locations'

const selectors = {
  alert: '[data-detail-alert]',
  name: '[data-product-name]',
  description: '[data-product-description]',
  season: '[data-product-season]',
  offersBody: '[data-offer-rows]',
  offersEmpty: '[data-offer-empty]',
  selectionStatus: '[data-selection-status]',
  selectedFarm: '[data-selected-farm]',
  inputProduct: '[data-input-product]',
  scheduleSelect: '[data-select-schedule]',
  quantityInput: '#subscribeQuantity',
  startInput: '#subscribeStart',
  form: '[data-subscribe-form]',
  formFeedback: '[data-form-feedback]',
  defaultLocation: '[data-default-location]',
  locationOptions: '[data-location-option]',
  customFields: '[data-custom-location-fields]',
  customStreet: '[data-custom-street]',
  customCity: '[data-custom-city]',
  customState: '[data-custom-state]',
  customCountry: '[data-custom-country]'
}

const state = {
  productId: null,
  offers: [],
  selectedOffer: null,
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

function setFormFeedback(message, isSuccess = false) {
  const el = $(selectors.formFeedback)
  if (!el) return
  el.textContent = message || ''
  el.classList.toggle('success', Boolean(isSuccess))
}

function setProductInfo(product) {
  setText(selectors.name, product?.productName || 'Subscription detail')
  setText(selectors.description, product?.description || '—')
  if (product?.seasonStart && product?.seasonEnd) {
    setText(selectors.season, `${product.seasonStart} – ${product.seasonEnd}`)
  } else {
    setText(selectors.season, 'Season TBA')
  }
}

function populateScheduleOptions(offer) {
  const select = $(selectors.scheduleSelect)
  if (!select) return
  select.innerHTML = ''
  if (!offer.standardSchedules || offer.standardSchedules.length === 0) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'Contact farm for schedules'
    select.appendChild(option)
    select.disabled = true
    return
  }
  offer.standardSchedules.forEach((days) => {
    const option = document.createElement('option')
    option.value = days
    option.textContent = `${days} days`
    select.appendChild(option)
  })
  select.disabled = false
}

function enableForm() {
  const quantity = $(selectors.quantityInput)
  const start = $(selectors.startInput)
  const formButton = document.querySelector(`${selectors.form} button[type="submit"]`)
  if (quantity) quantity.disabled = false
  if (start) {
    start.disabled = false
    if (!start.value) {
      start.value = new Date().toISOString().split('T')[0]
    }
  }
  if (formButton) formButton.disabled = false
}

function setInputValue(selector, value) {
  const el = $(selector)
  if (!el) return
  if ('value' in el) {
    el.value = value
  } else {
    el.textContent = value
  }
}

function handleOfferSelect(offer) {
  state.selectedOffer = offer
  const selectionStatus = $(selectors.selectionStatus)
  if (selectionStatus) {
    selectionStatus.textContent = `Requesting quote from Farm #${offer.farmId} (${offer.locationLabel}).`
  }
  setInputValue(selectors.selectedFarm, `Farm #${offer.farmId} (${offer.locationLabel})`)
  populateScheduleOptions(offer)
  enableForm()
  setFormFeedback('')
}

function renderOffers(offers) {
  const body = $(selectors.offersBody)
  const empty = $(selectors.offersEmpty)
  if (body) body.innerHTML = ''
  if (!offers || offers.length === 0) {
    if (empty) empty.hidden = false
    return
  }
  if (empty) empty.hidden = true
  offers.forEach((offer) => {
    if (!body) return
    const row = document.createElement('tr')

    const farmCell = document.createElement('td')
    farmCell.textContent = `Farm #${offer.farmId}`

    const locationCell = document.createElement('td')
    locationCell.textContent = offer.locationLabel

    const priceCell = document.createElement('td')
    if (offer.minPrice != null && offer.maxPrice != null) {
      priceCell.textContent = offer.minPrice === offer.maxPrice
        ? `₱${offer.minPrice.toFixed(2)}`
        : `₱${offer.minPrice.toFixed(2)} – ₱${offer.maxPrice.toFixed(2)}`
    } else if (offer.avgPrice != null) {
      priceCell.textContent = `~₱${offer.avgPrice.toFixed(2)}`
    } else {
      priceCell.textContent = 'TBD'
    }

    const inventoryCell = document.createElement('td')
    inventoryCell.textContent = `${offer.totalQuantity || 0} units · ${offer.batchCount} batch${offer.batchCount === 1 ? '' : 'es'}`

    const scheduleCell = document.createElement('td')
    if (offer.standardSchedules && offer.standardSchedules.length) {
      scheduleCell.textContent = offer.standardSchedules.map((days) => `${days}d`).join(' / ')
    } else {
      scheduleCell.textContent = 'Contact farm'
    }

    const actionCell = document.createElement('td')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'button outline'
    button.textContent = 'Request quote'
    button.addEventListener('click', () => handleOfferSelect(offer))
    actionCell.appendChild(button)

    row.appendChild(farmCell)
    row.appendChild(locationCell)
    row.appendChild(priceCell)
    row.appendChild(inventoryCell)
    row.appendChild(scheduleCell)
    row.appendChild(actionCell)
    body.appendChild(row)
  })
}

function setLocationMode(mode) {
  state.locationMode = mode
  const customFields = $(selectors.customFields)
  if (customFields) customFields.hidden = mode !== 'custom'
  const customInputs = [
    selectors.customStreet,
    selectors.customCity,
    selectors.customState,
    selectors.customCountry
  ]
  customInputs.forEach((selector) => {
    const input = $(selector)
    if (input) input.disabled = mode !== 'custom'
  })
}

function initLocationControls() {
  document.querySelectorAll(selectors.locationOptions).forEach((radio) => {
    radio.addEventListener('change', (event) => {
      if (event.target.checked) {
        setLocationMode(event.target.value === 'custom' ? 'custom' : 'default')
      }
    })
  })
  setLocationMode('default')
}

function validateCustomLocation() {
  const street = $(selectors.customStreet)?.value?.trim()
  const city = $(selectors.customCity)?.value?.trim()
  const stateValue = $(selectors.customState)?.value?.trim() || null
  const country = $(selectors.customCountry)?.value?.trim() || 'Philippines'
  if (!street || !city) {
    throw new Error('Custom address requires both street and city.')
  }
  return {
    street,
    city,
    state: stateValue,
    country,
    continent: 'Asia'
  }
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
    throw new Error(data.error || 'Failed to save delivery location.')
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
  const schedule = $(selectors.scheduleSelect)?.value
  const quantity = $(selectors.quantityInput)?.value
  const startDate = $(selectors.startInput)?.value
  if (!schedule) {
    throw new Error('Select a delivery schedule.')
  }
  if (!quantity || Number(quantity) <= 0) {
    throw new Error('Quantity must be greater than zero.')
  }
  if (!startDate) {
    throw new Error('Choose a start date.')
  }
  return {
    intervalDays: Number(schedule),
    quantity: Number(quantity),
    startDate
  }
}

async function submitRequest(event) {
  event.preventDefault()
  if (!state.selectedOffer) {
    setFormFeedback('Please choose a farm first.')
    return
  }
  try {
    setFormFeedback('Submitting quote request…', true)
    const locationId = await resolveLocationId()
    if (!locationId) {
      throw new Error('Please provide a delivery location.')
    }
    const requestPayload = serializeRequest()
    const payload = {
      productId: state.productId,
      farmId: state.selectedOffer.farmId,
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
      window.location.href = '/login.html#customer'
      return
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || 'Unable to create subscription request.')
    }
    setFormFeedback('Quote request sent! Redirecting…', true)
    setTimeout(() => {
      window.location.href = '/customer-subscribe.html'
    }, 800)
  } catch (error) {
    console.error('Subscription request error', error)
    setFormFeedback(error.message || 'Unable to create subscription.', false)
  }
}

async function loadOffers() {
  const params = new URLSearchParams(window.location.search)
  const productId = Number(params.get('productId'))
  if (!productId) {
    setAlert('Missing productId in URL.')
    return
  }
  state.productId = productId
  const productInput = $(selectors.inputProduct)
  if (productInput) productInput.value = productId
  try {
    setAlert('Loading farms…', true)
    const response = await fetch(`${PRODUCT_OFFERS_ENDPOINT}?productId=${productId}`, { credentials: 'include' })
    if (response.status === 401) {
      window.location.href = '/login.html#customer'
      return
    }
    if (!response.ok) {
      throw new Error('Failed to load product offerings.')
    }
    const data = await response.json()
    state.offers = data.offers || []
    state.defaultLocation = data.defaultLocation || null
    setProductInfo(data.product)
    renderOffers(state.offers)
    setText(selectors.defaultLocation, state.defaultLocation?.label || 'No default location set')
    setAlert('Select a farm to request a quote.', true)
  } catch (error) {
    console.error('Offer load error', error)
    setAlert('Unable to load offerings right now.', false)
  }
}

function init() {
  document.querySelector('form')?.setAttribute('data-subscribe-form', 'true')
  const form = $(selectors.form)
  if (form) {
    form.addEventListener('submit', submitRequest)
  }
  initLocationControls()
  loadOffers()
}

document.addEventListener('DOMContentLoaded', init)
