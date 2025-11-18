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
    const card = document.createElement('div')
    card.className = 'pending-item'

    const header = document.createElement('div')
    header.className = 'pending-item__header'
    const title = document.createElement('div')
    const heading = document.createElement('h3')
    const baseName = order.productName || `Order #${order.orderId}`
    heading.textContent = order.productGrade ? `${baseName} · Grade ${order.productGrade}` : baseName
    title.appendChild(heading)
    const pill = document.createElement('span')
    pill.className = `status-pill ${order.statusVariant || 'pending'}`
    pill.textContent = order.status
    header.appendChild(title)
    header.appendChild(pill)

    const columns = document.createElement('div')
    columns.className = 'pending-columns'
    const columnData = [
      {
        title: 'Due',
        value: formatDate(order.dueBy),
        entries: [
          { label: 'Unit price', value: order.unitPrice != null ? formatCurrency(order.unitPrice) : '—' },
          { label: 'Amount due', value: order.totalAmount != null ? formatCurrency(order.totalAmount) : '—' }
        ]
      },
      {
        title: 'Placed',
        value: formatDate(order.orderDate),
        entries: [
          { label: 'Quantity', value: order.quantity },
          { label: 'Subtotal', value: order.grossAmount != null ? formatCurrency(order.grossAmount) : '—' }
        ]
      },
      {
        title: 'Product',
        value: order.productGrade ? `Grade ${order.productGrade}` : order.productName || '—',
        entries: [
          { label: 'Farm', value: order.farmName || '—' },
          { label: 'Loyalty used', value: order.loyaltyDiscount ? `${order.loyaltyDiscount} pts` : '—' }
        ]
      }
    ]

    columnData.forEach((column) => {
      const columnEl = document.createElement('div')
      columnEl.className = 'pending-column'
      const heading = document.createElement('h4')
      heading.textContent = column.title
      const valueEl = document.createElement('p')
      valueEl.className = 'pending-value'
      valueEl.textContent = column.value
      columnEl.appendChild(heading)
      columnEl.appendChild(valueEl)
      const list = document.createElement('dl')
      column.entries.forEach((entry) => {
        const dt = document.createElement('dt')
        dt.textContent = entry.label
        const dd = document.createElement('dd')
        dd.textContent = entry.value
        list.appendChild(dt)
        list.appendChild(dd)
      })
      columnEl.appendChild(list)
      columns.appendChild(columnEl)
    })

    card.appendChild(header)
    card.appendChild(columns)
    container.appendChild(card)
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
    const header = document.createElement('div')
    header.className = 'subscription-card__header'
    const titleBlock = document.createElement('div')
    const tag = document.createElement('div')
    tag.className = 'tag'
    tag.textContent = intervalLabel(sub.intervalDays)
    const title = document.createElement('h3')
    title.textContent = sub.productName
    titleBlock.appendChild(tag)
    titleBlock.appendChild(title)
    const qty = document.createElement('span')
    qty.className = 'subscription-qty'
    qty.textContent = `Qty ${sub.quantity}`
    header.appendChild(titleBlock)
    header.appendChild(qty)
    card.appendChild(header)

    const infoList = document.createElement('dl')
    infoList.className = 'subscription-meta'
    const metaFields = [
      { label: 'Next delivery', value: formatDate(sub.nextDeliveryDate, 'TBD') },
      { label: 'Status', value: sub.status || 'AWAITING_QUOTE' },
      { label: 'Price', value: sub.price != null ? formatCurrency(sub.price) : 'Awaiting quote' },
      { label: 'Location', value: sub.locationLabel || 'Delivery location TBD' },
      { label: 'Farm', value: sub.farmName || (sub.farmId ? `Farm #${sub.farmId}` : 'TBD') }
    ]
    metaFields.forEach((field) => {
      const dt = document.createElement('dt')
      dt.textContent = field.label
      const dd = document.createElement('dd')
      dd.textContent = field.value
      infoList.appendChild(dt)
      infoList.appendChild(dd)
    })
    card.appendChild(infoList)
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
      window.location.href = '/login.html#customer'
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
