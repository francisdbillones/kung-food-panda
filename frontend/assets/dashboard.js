const DASHBOARD_ENDPOINT = '/api/customer/dashboard'
const selectors = {
  name: '[data-customer-name]',
  alert: '[data-dashboard-alert]',
  pendingCount: '[data-pending-count]',
  pendingContainer: '[data-pending-orders]',
  pendingEmpty: '[data-pending-empty]',
  subscriptionCount: '[data-subscription-count]',
  subscriptionContainer: '[data-subscriptions]',
  subscriptionEmpty: '[data-subscriptions-empty]',
  loyaltyPoints: '[data-loyalty-points]',
  loyaltyValue: '[data-loyalty-value]',
  loyaltyRefreshed: '[data-loyalty-refreshed]',
  recentBody: '[data-recent-orders]',
  recentEmpty: '[data-recent-empty]'
}

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
})

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric'
})

const dateLongFormatter = new Intl.DateTimeFormat('en-PH', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})

function $(selector) {
  return document.querySelector(selector)
}

function formatCurrency(value) {
  const number = Number(value)
  if (Number.isNaN(number)) return '—'
  return currencyFormatter.format(number)
}

function formatDate(value, fallback = '—') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return dateFormatter.format(date)
}

function pluralize(count, singular) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`
}

function intervalLabel(days) {
  if (!days) return 'Flexible cadence'
  if (days === 7) return 'Weekly'
  if (days === 14) return 'Bi-weekly'
  if (days === 30) return 'Monthly'
  return `Every ${days} days`
}

function setAlert(message, isSuccess = false) {
  const el = $(selectors.alert)
  if (!el) return
  el.textContent = message || ''
  el.classList.toggle('success', Boolean(isSuccess))
}

function updateName(profile) {
  const el = $(selectors.name)
  if (el && profile?.firstName) {
    el.textContent = profile.firstName
  }
}

function updateLoyalty(profile) {
  const points = Number(profile?.loyaltyPoints) || 0
  const ptsEl = $(selectors.loyaltyPoints)
  if (ptsEl) {
    ptsEl.textContent = `${points} pts`
  }
  const valueEl = $(selectors.loyaltyValue)
  if (valueEl) {
    valueEl.textContent = formatCurrency(points)
  }
  const refreshedEl = $(selectors.loyaltyRefreshed)
  if (refreshedEl) {
    refreshedEl.textContent = dateLongFormatter.format(new Date())
  }
}

function renderPendingOrders(orders) {
  const container = $(selectors.pendingContainer)
  const countEl = $(selectors.pendingCount)
  const emptyEl = $(selectors.pendingEmpty)
  if (!container) return
  container.innerHTML = ''
  if (orders.length === 0) {
    if (countEl) countEl.textContent = 'No pending orders'
    if (emptyEl) emptyEl.hidden = false
    return
  }
  if (countEl) countEl.textContent = `${pluralize(orders.length, 'order')} ready for fulfillment`
  if (emptyEl) emptyEl.hidden = true
  orders.forEach((order) => {
    const wrapper = document.createElement('div')
    const pill = document.createElement('div')
    pill.className = `status-pill ${order.statusVariant || 'pending'}`
    pill.textContent = `Order #${order.orderId} · ${order.status}`
    const info = document.createElement('p')
    const amountLabel = order.totalAmount != null ? formatCurrency(order.totalAmount) : '—'
    info.textContent = `${amountLabel} · qty ${order.quantity} · due ${formatDate(order.dueBy)} · ${order.productName}`
    wrapper.appendChild(pill)
    wrapper.appendChild(info)
    container.appendChild(wrapper)
  })
}

function renderSubscriptions(subscriptions) {
  const container = $(selectors.subscriptionContainer)
  const countEl = $(selectors.subscriptionCount)
  const emptyEl = $(selectors.subscriptionEmpty)
  if (!container) return
  container.innerHTML = ''
  if (subscriptions.length === 0) {
    if (countEl) countEl.textContent = 'No active subscriptions'
    if (emptyEl) emptyEl.hidden = false
    return
  }
  if (countEl) countEl.textContent = `${pluralize(subscriptions.length, 'program')} active`
  if (emptyEl) emptyEl.hidden = true
  subscriptions.forEach((sub) => {
    const card = document.createElement('div')
    card.className = 'subscription-card'
    const tag = document.createElement('div')
    tag.className = 'tag'
    tag.textContent = intervalLabel(sub.intervalDays)
    const title = document.createElement('h3')
    title.textContent = sub.productName
    const details = document.createElement('p')
    details.textContent = `Qty ${sub.quantity} · next ${formatDate(sub.nextDeliveryDate, 'TBD')}`
    const footnote = document.createElement('small')
    footnote.textContent = sub.locationLabel || 'Delivery location TBD'
    card.appendChild(tag)
    card.appendChild(title)
    card.appendChild(details)
    card.appendChild(footnote)
    container.appendChild(card)
  })
}

function renderRecentOrders(orders) {
  const tbody = $(selectors.recentBody)
  const emptyEl = $(selectors.recentEmpty)
  if (!tbody) return
  tbody.innerHTML = ''
  if (orders.length === 0) {
    if (emptyEl) emptyEl.hidden = false
    return
  }
  if (emptyEl) emptyEl.hidden = true
  orders.forEach((order) => {
    const row = document.createElement('tr')
    const dateCell = document.createElement('td')
    dateCell.textContent = formatDate(order.orderDate)
    const actionCell = document.createElement('td')
    actionCell.textContent = `Order #${order.orderId} · ${order.productName}`
    const amountCell = document.createElement('td')
    amountCell.textContent = order.totalAmount != null ? formatCurrency(order.totalAmount) : '—'
    const statusCell = document.createElement('td')
    const status = document.createElement('span')
    status.className = `status-pill ${order.statusVariant || 'pending'}`
    status.textContent = order.status
    statusCell.appendChild(status)
    row.appendChild(dateCell)
    row.appendChild(actionCell)
    row.appendChild(amountCell)
    row.appendChild(statusCell)
    tbody.appendChild(row)
  })
}

async function loadDashboard() {
  try {
    setAlert('Loading latest data…', true)
    const response = await fetch(DASHBOARD_ENDPOINT, { credentials: 'include' })
    if (response.status === 401) {
      window.location.href = '/login-customer.html'
      return
    }
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard data')
    }
    const data = await response.json()
    updateName(data.profile)
    updateLoyalty(data.profile)
    renderPendingOrders(data.pendingOrders || [])
    renderSubscriptions(data.subscriptions || [])
    renderRecentOrders(data.recentOrders || [])
    setAlert('Dashboard synchronized with live data.', true)
  } catch (error) {
    console.error('Dashboard load error', error)
    setAlert('Unable to load dashboard data right now.', false)
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard)
