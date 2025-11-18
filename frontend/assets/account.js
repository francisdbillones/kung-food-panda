const ACCOUNT_ENDPOINT = '/api/customer/account'
const LOCATION_ENDPOINT = '/api/customer/locations'

const selectors = {
  form: '[data-account-form]',
  fields: '[data-field]',
  feedback: '[data-account-feedback]',
  locationLabel: '[data-account-location-label]',
  locationOptions: '[data-account-location-option]',
  customFields: '[data-account-custom-fields]',
  customStreet: '[data-account-street]',
  customCity: '[data-account-city]',
  customState: '[data-account-state]',
  customCountry: '[data-account-country]',
  resetButton: '[data-account-reset]'
}

const state = {
  profile: null,
  location: null,
  mode: 'default'
}

function $(selector) {
  return document.querySelector(selector)
}

function setFeedback(message, isSuccess = false) {
  const el = $(selectors.feedback)
  if (!el) return
  el.textContent = message || ''
  el.classList.toggle('success', Boolean(isSuccess))
}

function fillForm(profile) {
  document.querySelectorAll(selectors.fields).forEach((input) => {
    const key = input.dataset.field
    if (!key) return
    if (profile[key] !== undefined) {
      input.value = profile[key] ?? ''
    }
  })
}

function fillLocation(location) {
  const el = $(selectors.locationLabel)
  if (el) {
    el.textContent = location?.label || 'No default address set'
  }
}

function setMode(mode) {
  state.mode = mode
  const customFields = $(selectors.customFields)
  if (customFields) customFields.hidden = mode !== 'custom'
  ;[selectors.customStreet, selectors.customCity, selectors.customState, selectors.customCountry].forEach((selector) => {
    const input = $(selector)
    if (input) input.disabled = mode !== 'custom'
  })
}

function resetCustomLocation() {
  const defaults = {
    [selectors.customStreet]: '',
    [selectors.customCity]: '',
    [selectors.customState]: '',
    [selectors.customCountry]: ''
  }
  Object.entries(defaults).forEach(([selector, value]) => {
    const input = $(selector)
    if (input) input.value = value
  })
}

function validateCustomLocation() {
  const street = $(selectors.customStreet)?.value?.trim()
  const city = $(selectors.customCity)?.value?.trim()
  const stateValue = $(selectors.customState)?.value?.trim() || null
  const country = $(selectors.customCountry)?.value?.trim() || ''
  const resolvedCountry = country || 'Philippines'
  if (!street || !city) {
    throw new Error('Custom address requires both street and city.')
  }
  return { street, city, state: stateValue, country: resolvedCountry, continent: 'Asia' }
}

async function createLocation(payload) {
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
    throw new Error(data.error || 'Unable to save address.')
  }
  return data.location
}

async function resolveLocationId() {
  if (state.mode === 'custom') {
    const payload = validateCustomLocation()
    const location = await createLocation(payload)
    return location?.locationId
  }
  return state.location?.locationId || null
}

function serializeProfile() {
  const payload = {}
  document.querySelectorAll(selectors.fields).forEach((input) => {
    const key = input.dataset.field
    if (!key || input.readOnly) return
    payload[key] = input.value || ''
  })
  return payload
}

async function loadAccount() {
  try {
    setFeedback('Loading account…', true)
    const response = await fetch(ACCOUNT_ENDPOINT, { credentials: 'include' })
    if (response.status === 401) {
      window.location.href = '/login.html#customer'
      return
    }
    if (!response.ok) {
      throw new Error('Failed to load account.')
    }
    const data = await response.json()
    state.profile = data.profile
    state.location = data.location
    fillForm(data.profile)
    fillLocation(data.location)
    setFeedback('Account ready.', true)
  } catch (error) {
    console.error('Account load error', error)
    setFeedback(error.message || 'Unable to load account.', false)
  }
}

async function handleSubmit(event) {
  event.preventDefault()
  try {
    setFeedback('Saving changes…', true)
    const locationId = await resolveLocationId()
    const payload = serializeProfile()
    if (locationId) {
      payload.locationId = locationId
    }
    const response = await fetch(ACCOUNT_ENDPOINT, {
      method: 'PUT',
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
      throw new Error(data.error || 'Unable to update account.')
    }
    state.profile = data.profile
    state.location = data.location
    fillForm(data.profile)
    fillLocation(data.location)
    setFeedback('Account updated successfully.', true)
  } catch (error) {
    console.error('Account save error', error)
    setFeedback(error.message || 'Unable to update account.', false)
  }
}

function initForm() {
  const form = document.querySelector('form')
  if (form) {
    form.setAttribute('data-account-form', 'true')
    form.addEventListener('submit', handleSubmit)
  }
  document.querySelectorAll(selectors.locationOptions).forEach((radio) => {
    radio.addEventListener('change', (event) => {
      if (event.target.checked) {
        setMode(event.target.value === 'custom' ? 'custom' : 'default')
      }
    })
  })
  const resetButton = $(selectors.resetButton)
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      fillForm(state.profile || {})
      fillLocation(state.location)
      setMode('default')
      resetCustomLocation()
      setFeedback('Form reset.', true)
    })
  }
}

function initPage() {
  setMode('default')
  resetCustomLocation()
  initForm()
  loadAccount()
}

document.addEventListener('DOMContentLoaded', initPage)
