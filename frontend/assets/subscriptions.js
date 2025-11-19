const SUBSCRIPTIONS_ENDPOINT = '/api/customer/subscriptions'

const selectors = {
  alert: '[data-subscription-alert]',
  requestsBody: '[data-request-rows]',
  requestsEmpty: '[data-requests-empty]',
  summaryTotal: '[data-summary-total]',
  summaryActive: '[data-summary-active]',
  summaryAwaiting: '[data-summary-awaiting]',
  nextDelivery: '[data-billing-next]',
  customerLocation: '[data-customer-location]'
}

const statusLabels = {
  AWAITING_QUOTE: 'Awaiting quote',
  QUOTED: 'Quoted',
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled'
}

const statusVariant = {
  AWAITING_QUOTE: 'pending',
  QUOTED: 'pending',
  ACTIVE: 'success',
  CANCELLED: ''
}

const cancellableStatuses = new Set(['AWAITING_QUOTE', 'QUOTED', 'ACTIVE'])

const frequencyLabels = {
  7: 'Weekly',
  14: 'Bi-weekly',
  30: 'Monthly'
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})

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

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

function isCancellable(subscription) {
  return subscription && cancellableStatuses.has(subscription.status)
}

function renderRequests(subscriptions) {
  const body = $(selectors.requestsBody)
  const empty = $(selectors.requestsEmpty)
  if (body) body.innerHTML = ''
  if (!subscriptions || subscriptions.length === 0) {
    if (empty) empty.hidden = false
    return
  }
  if (empty) empty.hidden = true

  subscriptions.forEach((sub) => {
    if (!body) return
    const row = document.createElement('tr')

    const productCell = document.createElement('td')
    productCell.textContent = sub.productName

    const farmCell = document.createElement('td')
    const farmLabel = sub.farmId ? `Farm #${sub.farmId}` : '—'
    const location = sub.locationLabel ? ` · ${sub.locationLabel}` : ''
    farmCell.textContent = `${farmLabel}${location}`

    const cadenceCell = document.createElement('td')
    const cadence = frequencyLabels[sub.intervalDays] || `Every ${sub.intervalDays} days`
    cadenceCell.textContent = cadence

    const quantityCell = document.createElement('td')
    quantityCell.textContent = sub.quantity

    const statusCell = document.createElement('td')
    const status = document.createElement('span')
    const variant = statusVariant[sub.status] || ''
    status.className = variant ? `status-pill ${variant}` : 'status-pill'
    status.textContent = statusLabels[sub.status] || sub.status
    statusCell.appendChild(status)

    const priceCell = document.createElement('td')
    priceCell.textContent = sub.price != null ? `₱${Number(sub.price).toFixed(2)}` : '—'

    const nextCell = document.createElement('td')
    nextCell.textContent = formatDate(sub.nextDeliveryDate)

    const actionsCell = document.createElement('td')
    if (isCancellable(sub)) {
      const cancelButton = document.createElement('button')
      cancelButton.type = 'button'
      cancelButton.className = 'button outline'
      cancelButton.textContent = 'Cancel'
      cancelButton.dataset.cancelSubscription = String(sub.programId)
      actionsCell.appendChild(cancelButton)
    } else {
      actionsCell.textContent = '—'
    }

    row.appendChild(productCell)
    row.appendChild(farmCell)
    row.appendChild(cadenceCell)
    row.appendChild(quantityCell)
    row.appendChild(statusCell)
    row.appendChild(priceCell)
    row.appendChild(nextCell)
    row.appendChild(actionsCell)
    body.appendChild(row)
  })
}

function renderSummary(subscriptions, locationLabel) {
  setText(selectors.summaryTotal, subscriptions.length || 0)
  const activeCount = subscriptions.filter((sub) => sub.status === 'ACTIVE').length
  const awaitingCount = subscriptions.filter((sub) => sub.status === 'AWAITING_QUOTE').length
  setText(selectors.summaryActive, activeCount)
  setText(selectors.summaryAwaiting, awaitingCount)
  const nextDates = subscriptions
    .filter((sub) => sub.status === 'ACTIVE')
    .map((sub) => new Date(sub.nextDeliveryDate))
    .filter((date) => !Number.isNaN(date.getTime()))
  const nextDelivery = nextDates.length ? nextDates.sort((a, b) => a - b)[0] : null
  setText(selectors.nextDelivery, nextDelivery ? formatDate(nextDelivery) : '—')
  setText(selectors.customerLocation, locationLabel || 'No default location set')
}

async function loadRequests(options = {}) {
  const { showStatus = true } = options
  try {
    if (showStatus) {
      setAlert('Loading subscription requests…', true)
    }
    const response = await fetch(SUBSCRIPTIONS_ENDPOINT, { credentials: 'include' })
    if (response.status === 401) {
      window.location.href = '/login.html#customer'
      return
    }
    if (!response.ok) {
      throw new Error('Failed to load subscription data.')
    }
    const data = await response.json()
    const subs = data.subscriptions || []
    renderRequests(subs)
    renderSummary(subs, data.location?.label)
    if (showStatus) {
      setAlert('Subscription requests updated.', true)
    }
  } catch (error) {
    console.error('Subscription list error', error)
    setAlert(error.message || 'Unable to load subscriptions.', false)
  }
}

async function requestCancellation(programId, control) {
  if (!programId) return
  const confirmed = window.confirm('Cancel this subscription? This cannot be undone.')
  if (!confirmed) return
  if (control) control.disabled = true
  try {
    setAlert('Cancelling subscription…')
    const response = await fetch(`${SUBSCRIPTIONS_ENDPOINT}/${programId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.status === 401) {
      window.location.href = '/login.html#customer'
      return
    }
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Unable to cancel subscription.')
    }
    setAlert(data?.line || 'Subscription cancelled.', true)
    await loadRequests({ showStatus: false })
  } catch (error) {
    console.error('Cancel subscription error', error)
    setAlert(error.message || 'Unable to cancel subscription.')
  } finally {
    if (control) control.disabled = false
  }
}

function handleRequestClick(event) {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest('[data-cancel-subscription]')
  if (!(button instanceof HTMLButtonElement)) return
  const programId = Number(button.getAttribute('data-cancel-subscription'))
  if (!programId) return
  requestCancellation(programId, button)
}

document.addEventListener('DOMContentLoaded', () => {
  const body = $(selectors.requestsBody)
  if (body) {
    body.addEventListener('click', handleRequestClick)
  }
  loadRequests()
})
