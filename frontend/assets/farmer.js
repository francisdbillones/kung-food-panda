const DASHBOARD_ENDPOINT = '/api/farmer/dashboard'
const INVENTORY_ENDPOINT = '/api/farmer/inventory'
const FULFILLMENT_ENDPOINT = '/api/farmer/fulfillments'
const OFFERINGS_ENDPOINT = '/api/farmer/offerings'
const REPORT_CATALOG_ENDPOINT = '/api/farmer/reports'
const REPORT_PDF_ENDPOINT = '/api/farmer/reports/pdf'
const LOGIN_FALLBACK = '/login.html#farmer'

const selectors = {
  alerts: {
    dashboard: '[data-dashboard-alert]',
    inventory: '[data-inventory-alert]',
    orders: '[data-order-alert]',
    subscriptions: '[data-subscription-alert]',
    offerings: '[data-offering-alert]'
  },
  farmId: '[data-farm-id]',
  farmNameInline: '[data-farm-name]',
  farmLocation: '[data-farm-location]',
  refreshButton: '[data-refresh-dashboard]',
  inventoryProducts: '[data-inventory-products]',
  inventoryEmpty: '[data-inventory-empty]',
  inventoryCount: '[data-inventory-count]',
  inventoryForm: '[data-inventory-form]',
  inventoryProductSelect: '[data-inventory-product]',
  orderList: '[data-order-list]',
  orderEmpty: '[data-order-empty]',
  orderCount: '[data-order-count]',
  shipmentList: '[data-shipment-list]',
  subscriptionList: '[data-subscription-list]',
  subscriptionEmpty: '[data-subscription-empty]',
  subscriptionCount: '[data-subscription-count]',
  offeringTable: '[data-offering-table]',
  offeringEmpty: '[data-offering-empty]',
  offeringCount: '[data-offering-count]',
  offeringForm: '[data-offering-form]',
  offeringProductSelect: '[data-offering-product]',
  offeringExistingFields: '[data-offering-existing-fields]',
  offeringProductMode: '[data-offering-product-mode]',
  offeringNewFields: '[data-offering-new-fields]',
  reports: {
    list: '[data-report-list]',
    form: '[data-report-form]',
    results: '[data-report-results]',
    empty: '[data-report-empty]',
    summary: '[data-report-summary]',
    chart: '[data-report-chart]',
    table: '[data-report-table]',
    offerings: '[data-report-offerings]'
  },
  reportClearButton: '[data-clear-report]',
  reportRefreshButton: '[data-refresh-reports]',
  tabs: {
    buttons: '[data-tab-button]',
    contents: '[data-tab-content]'
  }
}

const state = {
  farm: null,
  inventory: [],
  orders: { pending: [], fulfilled: [] },
  subscriptions: [],
  offerings: { active: [], availableProducts: [] },
  reports: {
    catalog: [],
    options: { products: [] },
    activeReportId: null,
    result: null,
    userAdjustedFilters: false
  }
}

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
})

const weightFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})

const PRODUCT_GRADES = ['SSR', 'SR', 'R', 'UC', 'C']

function $(selector) {
  return document.querySelector(selector)
}

function formatCurrency(value) {
  const number = Number(value)
  if (Number.isNaN(number)) return '—'
  return currencyFormatter.format(number)
}

function formatUnitWeight(value, fallback = 'Weight TBD') {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return `${weightFormatter.format(number)} kg/unit`
}

function formatDateOnly(date) {
  if (!(date instanceof Date)) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return formatDateOnly(date)
}

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatDateOnly(date)
}

function normalizeInputDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function todayInputValue() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return formatDateOnly(today)
}

function setActiveTab(tabId) {
  document.querySelectorAll(selectors.tabs.buttons).forEach((button) => {
    const isActive = button.dataset.tabButton === tabId
    button.classList.toggle('active', isActive)
  })
  document.querySelectorAll(selectors.tabs.contents).forEach((content) => {
    const key = content.getAttribute('data-tab-content')
    if (!key) return
    content.hidden = key !== tabId
  })
}

function handleTabButtonClick(event) {
  const button = event.currentTarget
  const tabId = button?.dataset.tabButton
  if (tabId) {
    setActiveTab(tabId)
  }
}

function renderReportList() {
  const container = $(selectors.reports.list)
  if (!container) return
  container.innerHTML = ''
  const reports = state.reports.catalog || []
  if (!reports.length) {
    const message = document.createElement('p')
    message.className = 'muted-text'
    message.textContent = 'No reports configured yet.'
    container.appendChild(message)
    return
  }
  reports.forEach((report) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'report-card'
    button.dataset.reportId = report.id
    if (report.id === state.reports.activeReportId) {
      button.classList.add('active')
    }
    const title = document.createElement('strong')
    title.textContent = report.title
    const description = document.createElement('p')
    description.className = 'muted-text'
    description.textContent = report.description
    button.appendChild(title)
    button.appendChild(description)
    container.appendChild(button)
  })
}

function handleReportListClick(event) {
  const target = event.target.closest('[data-report-id]')
  if (!target) return
  const reportId = target.dataset.reportId
  if (!reportId || reportId === state.reports.activeReportId) return
  state.reports.activeReportId = reportId
  renderReportList()
  setFeedback('reports', 'Report selected. Choose a date range and generate.', true)
}

async function loadReportOptions() {
  const refreshButton = $(selectors.reportRefreshButton)
  if (refreshButton) refreshButton.disabled = true
  try {
    setFeedback('reports', 'Loading report catalog…', true)
    const data = await fetchJson(REPORT_CATALOG_ENDPOINT)
    state.reports.catalog = data?.reports || []
    state.reports.activeReportId = state.reports.catalog[0]?.id || null
    renderReportList()
    setReportFormDefaults({ reset: true })
    setFeedback('reports', data?.line || 'Reports ready to generate.', true)
  } catch (error) {
    console.error('Report catalog error', error)
    setFeedback('reports', error.message || 'Unable to load report catalog.', false)
  } finally {
    if (refreshButton) refreshButton.disabled = false
  }
}

function handleReportClear(event) {
  event.preventDefault()
  setReportFormDefaults({ reset: true })
  setFeedback('reports', 'Filters reset. Generate to export a fresh document.', true)
}

async function submitReportForm(event) {
  event.preventDefault()
  const form = event.currentTarget
  const fromValue = form.startDateFrom?.value
  const toValue = form.startDateTo?.value
  if (!fromValue || !toValue) {
    setFeedback('reports', 'Select a start and end date.', false)
    return
  }
  const payload = {
    startDateFrom: fromValue,
    startDateTo: toValue
  }
  try {
    setFeedback('reports', 'Generating report…', true)
    const data = await fetchJson(REPORT_PDF_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (data?.url) {
      setFeedback('reports', 'Opening PDF…', true)
      window.location.href = data.url
      return
    }
    setFeedback('reports', 'Report generated but no download link provided.', false)
  } catch (error) {
    console.error('Farm pdf report error', error)
    setFeedback('reports', error.message || 'Unable to generate the report.', false)
  }
}

function hasUsableOptions(select) {
  if (!select) return false
  return Array.from(select.options || []).some((option) => option.value)
}

function applyOfferingFormMode() {
  const form = $(selectors.offeringForm)
  if (!form) return
  const modeInput = form.querySelector(selectors.offeringProductMode)
  const mode = modeInput?.value || 'existing'
  const isNew = mode === 'new'
  const productSelect = form.querySelector(selectors.offeringProductSelect)
  const canChooseExisting = hasUsableOptions(productSelect)
  const existingFields = form.querySelector(selectors.offeringExistingFields)
  if (productSelect) {
    productSelect.disabled = isNew || !canChooseExisting
    productSelect.required = !isNew
    if (isNew) {
      productSelect.value = ''
    }
  }
  const newFields = form.querySelector(selectors.offeringNewFields)
  if (newFields) {
    newFields.hidden = !isNew
    newFields.style.display = isNew ? '' : 'none'
    newFields.querySelectorAll('input, select').forEach((input) => {
      input.required = isNew
      if (!isNew) {
        input.value = ''
      }
    })
  }
  if (existingFields) {
    existingFields.hidden = isNew
    existingFields.style.display = isNew ? 'none' : ''
  }
}

function readNewProductPayload(form) {
  const productName = form.newProductName?.value?.trim()
  if (!productName) {
    return { error: 'Enter a product name.' }
  }
  const productType = form.newProductType?.value?.trim()
  if (!productType) {
    return { error: 'Enter a product type.' }
  }
  const grade = form.newProductGrade?.value?.trim().toUpperCase()
  if (!PRODUCT_GRADES.includes(grade)) {
    return { error: 'Select a valid product grade.' }
  }
  const startDate = normalizeInputDate(form.newProductStartSeason?.value)
  if (!startDate) {
    return { error: 'Enter a valid season start date.' }
  }
  const endDate = normalizeInputDate(form.newProductEndSeason?.value)
  if (!endDate) {
    return { error: 'Enter a valid season end date.' }
  }
  if (endDate.getTime() <= startDate.getTime()) {
    return { error: 'Season end date must be after the start date.' }
  }
  return {
    payload: {
      productName,
      productType,
      grade,
      startSeason: formatDateOnly(startDate),
      endSeason: formatDateOnly(endDate)
    }
  }
}

function isFutureDate(value) {
  const date = normalizeInputDate(value)
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date > today
}

function isPastDate(value) {
  const date = normalizeInputDate(value)
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

function defaultReportDateRange() {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 90)
  return {
    from: formatDateOnly(start),
    to: formatDateOnly(end)
  }
}

function setReportFormDefaults({ reset = false } = {}) {
  const form = $(selectors.reports.form)
  if (!form) return
  const { from, to } = defaultReportDateRange()
  const fromInput = form.querySelector('input[name="startDateFrom"]')
  const toInput = form.querySelector('input[name="startDateTo"]')
  if (fromInput && (reset || !fromInput.value)) {
    fromInput.value = from
  }
  if (toInput && (reset || !toInput.value)) {
    toInput.value = to
  }
}

function setFeedback(section, message, isSuccess = false) {
  const selector = selectors.alerts[section]
  if (!selector) return
  const el = $(selector)
  if (!el) return
  el.textContent = message || ''
  el.classList.toggle('success', Boolean(isSuccess))
}

function availableInventoryForProduct(productId) {
  return state.inventory.filter((item) => item.productId === productId)
}

function productsNotYetOffered() {
  const activeIds = new Set(state.offerings.active.map((item) => item.productId))
  return (state.offerings.availableProducts || []).filter((product) => !activeIds.has(product.productId))
}

function groupInventoryByProduct() {
  const offerings = state.offerings?.active || []
  const map = new Map()
  offerings.forEach((offering) => {
    map.set(offering.productId, {
      productId: offering.productId,
      productName: offering.productName,
      productType: offering.productType,
      grade: offering.grade,
      batches: [],
      totalQuantity: 0,
      batchCount: 0
    })
  })
  state.inventory.forEach((batch) => {
    if (!map.has(batch.productId)) {
      map.set(batch.productId, {
        productId: batch.productId,
        productName: batch.productName,
        productType: batch.productType,
        grade: batch.productGrade,
        batches: [],
        totalQuantity: 0,
        batchCount: 0
      })
    }
    const group = map.get(batch.productId)
    group.batches.push(batch)
    group.batchCount += 1
    group.totalQuantity += Number(batch.quantity) || 0
  })
  return Array.from(map.values()).sort((a, b) => {
    const nameA = a.productName || ''
    const nameB = b.productName || ''
    return nameA.localeCompare(nameB)
  })
}

function findBatchById(batchId) {
  if (!batchId) return null
  return state.inventory.find((batch) => batch.batchId === Number(batchId)) || null
}

function populateBatchForm(card, batch) {
  const select = card.querySelector('[data-batch-select]')
  if (select) {
    if (batch?.batchId != null) {
      select.value = batch.batchId
    } else {
      select.value = ''
    }
  }
  const inputs = card.querySelectorAll('[data-batch-field]')
  const buttons = card.querySelectorAll('[data-batch-action]')
  const emptyMessage = card.querySelector('[data-no-batch]')
  const expirationNotice = card.querySelector('[data-expiration-notice]')
  inputs.forEach((input) => {
    const field = input.dataset.batchField
    if (!batch) {
      input.value = ''
      input.disabled = true
      return
    }
    input.disabled = false
    if (field === 'notes') {
      input.value = batch.notes || ''
    } else if (field === 'expDate') {
      input.value = toDateInput(batch.expDate)
    } else {
      const value = batch[field]
      input.value = value != null ? value : ''
    }
  })
  buttons.forEach((button) => {
    button.disabled = !batch
  })
  if (emptyMessage) {
    emptyMessage.hidden = Boolean(batch)
  }
  if (expirationNotice) {
    if (batch && batch.expDate && isPastDate(batch.expDate)) {
      expirationNotice.hidden = false
      expirationNotice.textContent = `Batch expired on ${formatDate(batch.expDate)}. Delete it or restock to prevent accidental shipments.`
    } else {
      expirationNotice.hidden = true
      expirationNotice.textContent = ''
    }
  }
}

function updateHero() {
  const farmIdEl = $(selectors.farmId)
  if (farmIdEl) {
    farmIdEl.textContent = state.farm?.farmId || '—'
  }
  const farmNameInline = $(selectors.farmNameInline)
  if (farmNameInline) {
    farmNameInline.textContent = state.farm?.name || '—'
  }
  const farmLocationEl = $(selectors.farmLocation)
  if (farmLocationEl) {
    farmLocationEl.textContent = state.farm?.locationLabel || 'Location pending'
  }
}

function renderInventory() {
  const container = $(selectors.inventoryProducts)
  const empty = $(selectors.inventoryEmpty)
  const countEl = $(selectors.inventoryCount)
  if (!container) return
  container.innerHTML = ''
  const groups = groupInventoryByProduct()
  if (countEl) {
    countEl.textContent = groups.length
  }
  if (!groups.length) {
    if (empty) empty.hidden = false
    return
  }
  if (empty) empty.hidden = true

  groups.forEach((group) => {
    const card = document.createElement('div')
    card.className = 'management-item inventory-product'
    card.dataset.productCard = ''
    card.dataset.productId = group.productId

    const header = document.createElement('div')
    header.className = 'management-item__header'
    const title = document.createElement('div')
    const typeLabel = [group.productType, group.grade ? `Grade ${group.grade}` : ''].filter(Boolean).join(' · ')
    title.innerHTML = `<strong>${group.productName || `Product #${group.productId}`}</strong><br><small>${typeLabel}</small>`
    const stats = document.createElement('div')
    stats.innerHTML = `<small>Inventory</small><p><strong>${group.totalQuantity}</strong> units · ${group.batchCount} batches</p>`
    const expiredBatches = group.batches.filter((batch) => batch.expDate && isPastDate(batch.expDate))
    if (expiredBatches.length) {
      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = `${expiredBatches.length} expired ${expiredBatches.length === 1 ? 'batch' : 'batches'}`
      badge.title = 'Expired batches should be removed so they are not promised to customers.'
      stats.appendChild(badge)
    }
    header.appendChild(title)
    header.appendChild(stats)
    card.appendChild(header)

    const selectWrapper = document.createElement('div')
    selectWrapper.className = 'form-group'
    const selectLabel = document.createElement('label')
    selectLabel.textContent = 'Select batch to edit'
    const select = document.createElement('select')
    select.dataset.batchSelect = ''
    if (!group.batches.length) {
      const option = document.createElement('option')
      option.value = ''
      option.textContent = 'No batches recorded yet'
      select.appendChild(option)
      select.disabled = true
    } else {
      const placeholder = document.createElement('option')
      placeholder.value = ''
      placeholder.textContent = 'Choose a batch'
      select.appendChild(placeholder)
      group.batches.forEach((batch) => {
        const option = document.createElement('option')
        option.value = batch.batchId
        const expired = batch.expDate && isPastDate(batch.expDate)
        const suffix = expired ? ' · expired' : ''
        option.textContent = `Batch #${batch.batchId} · ${batch.quantity} units · exp ${formatDate(batch.expDate)}${suffix}`
        select.appendChild(option)
      })
      select.value = group.batches[0]?.batchId || ''
    }
    selectWrapper.appendChild(selectLabel)
    selectWrapper.appendChild(select)
    card.appendChild(selectWrapper)

    const expirationNotice = document.createElement('div')
    expirationNotice.className = 'entity-message'
    expirationNotice.dataset.expirationNotice = ''
    expirationNotice.hidden = true
    card.appendChild(expirationNotice)

    const emptyMessage = document.createElement('p')
    emptyMessage.className = 'muted'
    emptyMessage.dataset.noBatch = ''
    emptyMessage.textContent = 'No batches yet for this product. Add one below to start tracking inventory.'
    if (group.batches.length) {
      emptyMessage.hidden = true
    }
    card.appendChild(emptyMessage)

    const fieldsWrapper = document.createElement('div')
    fieldsWrapper.className = 'grid inventory-batch-form'
    const fieldConfigs = [
      { label: 'Price (₱)', field: 'price', type: 'number', step: '0.01', min: '0' },
      { label: 'Weight (kg)', field: 'weight', type: 'number', step: '0.01', min: '0.01' },
      { label: 'Quantity', field: 'quantity', type: 'number', min: '0' },
      { label: 'Expiration', field: 'expDate', type: 'date' },
      { label: 'Notes', field: 'notes', type: 'text', placeholder: 'Optional description' }
    ]
    fieldConfigs.forEach((config) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'form-group'
      const label = document.createElement('label')
      label.textContent = config.label
      const input = document.createElement('input')
      input.type = config.type || 'text'
      if (config.step) input.step = config.step
      if (config.min !== undefined) input.min = config.min
      if (config.placeholder) input.placeholder = config.placeholder
      input.dataset.batchField = config.field
      wrapper.appendChild(label)
      wrapper.appendChild(input)
      fieldsWrapper.appendChild(wrapper)
    })
    card.appendChild(fieldsWrapper)

    const controls = document.createElement('div')
    controls.className = 'management-item__controls'
    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.className = 'button'
    saveBtn.textContent = 'Save changes'
    saveBtn.dataset.batchAction = 'save'
    const deleteBtn = document.createElement('button')
    deleteBtn.type = 'button'
    deleteBtn.className = 'button outline'
    deleteBtn.textContent = 'Delete batch'
    deleteBtn.dataset.batchAction = 'delete'
    controls.appendChild(saveBtn)
    controls.appendChild(deleteBtn)
    card.appendChild(controls)

    container.appendChild(card)
    const initialBatch = group.batches.length ? group.batches[0] : null
    populateBatchForm(card, initialBatch)
  })
}

function renderOrders() {
  const container = $(selectors.orderList)
  const empty = $(selectors.orderEmpty)
  const countEl = $(selectors.orderCount)
  if (!container) return
  container.innerHTML = ''
  const orders = state.orders?.pending || []
  if (countEl) {
    countEl.textContent = orders.length
  }
  if (!orders.length) {
    if (empty) empty.hidden = false
    return
  }
  if (empty) empty.hidden = true

  orders.forEach((order) => {
    const card = document.createElement('div')
    card.className = 'management-item'
    card.dataset.orderId = order.orderId
    const header = document.createElement('div')
    header.className = 'management-item__header'
    header.innerHTML = `<div><strong>Order #${order.orderId}</strong><br>${order.productName || 'Product'} · ${order.clientLabel || ''}</div>`
    const amount = document.createElement('div')
    const weightLabel = formatUnitWeight(order.unitWeight)
    amount.innerHTML = `<small>Quantity</small><p><strong>${order.quantity}</strong><br><span class="muted">${weightLabel}</span></p>`
    header.appendChild(amount)

    const info = document.createElement('p')
    info.className = 'muted'
    info.textContent = `${order.shipTo || 'Ship to TBD'} · Due ${formatDate(order.dueBy)}`

    const controls = document.createElement('div')
    controls.className = 'management-item__controls'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'button'
    button.textContent = 'Ship order'
    button.dataset.action = 'fulfill-order'
    controls.appendChild(button)

    card.appendChild(header)
    card.appendChild(info)
    card.appendChild(controls)

    container.appendChild(card)
  })
}

function renderShipments() {
  const list = $(selectors.shipmentList)
  if (!list) return
  list.innerHTML = ''
  const shipped = state.orders?.fulfilled || []
  if (!shipped.length) {
    const li = document.createElement('li')
    li.textContent = 'No shipments recorded yet.'
    list.appendChild(li)
    return
  }
  shipped.forEach((order) => {
    const li = document.createElement('li')
    const weightLabel = formatUnitWeight(order.unitWeight)
    li.textContent = `#${order.orderId} · ${order.productName || 'Product'} · ${order.quantity} units (${weightLabel}) · ${formatDate(order.orderDate)}`
    list.appendChild(li)
  })
}

function buildSubscriptionActions(subscription) {
  const actions = document.createElement('div')
  actions.className = 'subscription-actions'
  const status = subscription.status

  const priceInput = document.createElement('input')
  priceInput.type = 'number'
  priceInput.step = '0.01'
  priceInput.min = '0'
  priceInput.placeholder = 'Quote price'
  priceInput.value = subscription.price != null ? subscription.price : ''
  priceInput.dataset.subscriptionPrice = ''
  priceInput.disabled = status !== 'AWAITING_QUOTE'
  actions.appendChild(priceInput)

  if (status === 'AWAITING_QUOTE') {
    const quoteBtn = document.createElement('button')
    quoteBtn.type = 'button'
    quoteBtn.className = 'button'
    quoteBtn.dataset.action = 'quote'
    quoteBtn.textContent = 'Send quote'
    const rejectBtn = document.createElement('button')
    rejectBtn.type = 'button'
    rejectBtn.className = 'button outline'
    rejectBtn.dataset.action = 'reject'
    rejectBtn.textContent = 'Reject request'
    actions.appendChild(quoteBtn)
    actions.appendChild(rejectBtn)
  } else if (status === 'ACTIVE') {
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'button outline'
    cancelBtn.dataset.action = 'cancel'
    cancelBtn.textContent = 'Cancel subscription'
    actions.appendChild(cancelBtn)
  } else if (status === 'QUOTED') {
    const note = document.createElement('small')
    note.className = 'muted'
    note.textContent = 'Awaiting customer decision.'
    actions.appendChild(note)
  }

  return actions
}

function buildSubscriptionFulfillment(subscription) {
  const wrapper = document.createElement('div')
  wrapper.className = 'subscription-fulfillment'
  const note = document.createElement('p')
  note.className = 'muted'
  note.style.margin = '0'
  const nextDelivery = subscription.nextDeliveryDate || subscription.startDate
  if (subscription.status === 'CANCELLED') {
    note.textContent = 'This program has been cancelled. No future deliveries are scheduled.'
  } else if (subscription.status === 'ACTIVE') {
    note.textContent = `Next delivery target: ${formatDate(nextDelivery)}.`
  } else if (subscription.status === 'QUOTED') {
    note.textContent = 'Awaiting customer approval. Deliveries will be scheduled once the quote is accepted.'
  } else {
    note.textContent = 'Fulfillment opens once the customer activates this subscription.'
  }
  wrapper.appendChild(note)
  return wrapper
}

function renderSubscriptions() {
  const container = $(selectors.subscriptionList)
  const empty = $(selectors.subscriptionEmpty)
  const countEl = $(selectors.subscriptionCount)
  if (!container) return
  container.innerHTML = ''
  const subscriptions = state.subscriptions || []
  if (countEl) {
    countEl.textContent = subscriptions.length
  }
  if (!subscriptions.length) {
    if (empty) empty.hidden = false
    return
  }
  if (empty) empty.hidden = true

  subscriptions.forEach((subscription) => {
    const card = document.createElement('div')
    card.className = 'subscription-card management-item'
    card.dataset.programId = subscription.programId

    const header = document.createElement('div')
    header.className = 'management-item__header'
    header.innerHTML = `<div><strong>${subscription.productName}</strong><br>${subscription.customerName}</div>`
    const badge = document.createElement('span')
    badge.className = `status-pill ${subscription.status === 'ACTIVE' ? 'success' : 'pending'}`
    badge.textContent = subscription.status
    header.appendChild(badge)

    const details = document.createElement('p')
    details.className = 'muted'
    const cadence = subscription.intervalDays ? `Every ${subscription.intervalDays} days` : 'Flexible schedule'
    details.textContent = `${cadence} · Qty ${subscription.quantity} · ${subscription.locationLabel || 'Location TBD'}`

    const actions = buildSubscriptionActions(subscription)
    const fulfillment = buildSubscriptionFulfillment(subscription)

    card.appendChild(header)
    card.appendChild(details)
    card.appendChild(actions)
    card.appendChild(fulfillment)

    container.appendChild(card)
  })
}

function renderOfferings() {
  const tbody = $(selectors.offeringTable)
  const empty = $(selectors.offeringEmpty)
  const countEl = $(selectors.offeringCount)
  if (!tbody) return
  tbody.innerHTML = ''
  const offerings = state.offerings?.active || []
  if (countEl) {
    countEl.textContent = offerings.length
  }
  if (!offerings.length) {
    if (empty) empty.hidden = false
  } else if (empty) {
    empty.hidden = true
  }

  offerings.forEach((offering) => {
    const row = document.createElement('tr')
    row.dataset.productId = offering.productId
    row.setAttribute('data-offering-row', '')

    const infoCell = document.createElement('td')
    infoCell.innerHTML = `<strong>${offering.productName}</strong><br><small>${offering.productType || ''} · Grade ${offering.grade || ''}</small>`

    const populationCell = document.createElement('td')
    const popInput = document.createElement('input')
    popInput.type = 'number'
    popInput.min = '0'
    popInput.value = offering.population || 0
    popInput.setAttribute('data-offering-population', '')
    populationCell.appendChild(popInput)

    const unitCell = document.createElement('td')
    const unitInput = document.createElement('input')
    unitInput.type = 'text'
    unitInput.placeholder = 'e.g. trees'
    unitInput.value = offering.populationUnit || ''
    unitInput.setAttribute('data-offering-population-unit', '')
    unitCell.appendChild(unitInput)

    const actionCell = document.createElement('td')
    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.className = 'button'
    saveBtn.textContent = 'Save'
    saveBtn.dataset.action = 'update-offering'
    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'button outline'
    removeBtn.textContent = 'Remove'
    removeBtn.dataset.action = 'delete-offering'
    actionCell.appendChild(saveBtn)
    actionCell.appendChild(removeBtn)

    row.appendChild(infoCell)
    row.appendChild(populationCell)
    row.appendChild(unitCell)
    row.appendChild(actionCell)
    tbody.appendChild(row)
  })

  populateInventoryProductOptions()
  populateOfferingOptions()
}

function populateInventoryProductOptions() {
  const select = $(selectors.inventoryProductSelect)
  if (!select) return
  select.innerHTML = ''
  const offerings = state.offerings?.active || []
  if (!offerings.length) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'Add a product offering first'
    select.appendChild(option)
    select.disabled = true
    return
  }
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = 'Select product'
  select.appendChild(placeholder)
  offerings.forEach((offering) => {
    const option = document.createElement('option')
    option.value = offering.productId
    option.textContent = offering.productName
    select.appendChild(option)
  })
  select.disabled = false
}

function populateOfferingOptions() {
  const select = $(selectors.offeringProductSelect)
  if (!select) return
  select.innerHTML = ''
  const available = productsNotYetOffered()
  if (!available.length) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'All products already added'
    select.appendChild(option)
    select.disabled = true
    applyOfferingFormMode()
    return
  }
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = 'Select product'
  select.appendChild(placeholder)
  available.forEach((product) => {
    const option = document.createElement('option')
    option.value = product.productId
    option.textContent = `${product.productName} (${product.productType || ''})`
    select.appendChild(option)
  })
  select.disabled = false
  applyOfferingFormMode()
}

async function fetchJson(url, options = {}) {
  const config = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  }
  const response = await fetch(url, config)
  if (response.status === 401) {
    window.location.href = LOGIN_FALLBACK
    return null
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.')
    error.statusCode = response.status
    throw error
  }
  return data
}

async function loadDashboard() {
  try {
    setFeedback('dashboard', 'Syncing with live data…', true)
    const response = await fetch(DASHBOARD_ENDPOINT, { credentials: 'include' })
    if (response.status === 401) {
      window.location.href = LOGIN_FALLBACK
      return
    }
    if (!response.ok) {
      throw new Error('Unable to load farmer data.')
    }
    const data = await response.json()
    state.farm = data.farm || null
    state.inventory = data.inventory || []
    state.orders = data.orders || { pending: [], fulfilled: [] }
    state.subscriptions = data.subscriptions || []
    state.offerings = data.offerings || { active: [], availableProducts: [] }
    updateHero()
    renderInventory()
    renderOrders()
    renderShipments()
    renderSubscriptions()
    renderOfferings()
    setFeedback('dashboard', data.line || 'Console synchronized.', true)
  } catch (error) {
    console.error('Farmer dashboard load error', error)
    setFeedback('dashboard', error.message || 'Unable to load farmer data.', false)
  }
}

async function submitInventoryForm(event) {
  event.preventDefault()
  const form = event.currentTarget
  const productId = Number($(selectors.inventoryProductSelect)?.value)
  if (!productId) {
    setFeedback('inventory', 'Select a product before adding a batch.', false)
    return
  }
  const payload = {
    productId,
    price: Number(form.price.value),
    weight: Number(form.weight.value),
    quantity: Number(form.quantity.value),
    expDate: form.expDate.value,
    notes: form.notes.value?.trim() || undefined
  }
  if (!payload.expDate) {
    setFeedback('inventory', 'Select an expiration date.', false)
    return
  }
  if (isPastDate(payload.expDate)) {
    setFeedback('inventory', 'Expiration date cannot be in the past.', false)
    return
  }
  try {
    setFeedback('inventory', 'Saving batch…', true)
    await fetchJson(INVENTORY_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    form.reset()
    setFeedback('inventory', 'Batch added successfully.', true)
    await loadDashboard()
  } catch (error) {
    console.error('Inventory add error', error)
    setFeedback('inventory', error.message || 'Unable to add batch.', false)
  }
}

function readBatchForm(card) {
  const payload = {}
  card.querySelectorAll('[data-batch-field]').forEach((input) => {
    const field = input.dataset.batchField
    if (field === 'notes') {
      payload.notes = input.value?.trim() || null
    } else if (field === 'expDate') {
      payload.expDate = input.value
    } else {
      const value = Number(input.value)
      payload[field] = Number.isNaN(value) ? null : value
    }
  })
  return payload
}

function getSelectedBatchId(card) {
  const select = card.querySelector('[data-batch-select]')
  if (!select) return null
  if (!select.value) return null
  const batchId = Number(select.value)
  return Number.isNaN(batchId) ? null : batchId
}

function handleBatchSelectChange(event) {
  const select = event.target.closest('[data-batch-select]')
  if (!select) return
  const card = select.closest('[data-product-card]')
  if (!card) return
  if (!select.value) {
    populateBatchForm(card, null)
    return
  }
  const batch = findBatchById(Number(select.value))
  populateBatchForm(card, batch || null)
}

async function handleInventoryCardClick(event) {
  const button = event.target.closest('[data-batch-action]')
  if (!button) return
  const card = button.closest('[data-product-card]')
  if (!card) return
  const batchId = getSelectedBatchId(card)
  if (!batchId) {
    setFeedback('inventory', 'Select a batch to update.', false)
    return
  }
  if (button.dataset.batchAction === 'save') {
    const payload = readBatchForm(card)
    try {
      setFeedback('inventory', 'Updating batch…', true)
      await fetchJson(`${INVENTORY_ENDPOINT}/${batchId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      setFeedback('inventory', 'Inventory batch updated.', true)
      await loadDashboard()
    } catch (error) {
      console.error('Inventory update error', error)
      setFeedback('inventory', error.message || 'Unable to update batch.', false)
    }
  } else if (button.dataset.batchAction === 'delete') {
    if (!window.confirm('Delete this batch? This cannot be undone.')) {
      return
    }
    try {
      setFeedback('inventory', 'Removing batch…', true)
      await fetchJson(`${INVENTORY_ENDPOINT}/${batchId}`, { method: 'DELETE' })
      setFeedback('inventory', 'Batch removed.', true)
      await loadDashboard()
    } catch (error) {
      console.error('Inventory delete error', error)
      setFeedback('inventory', error.message || 'Unable to remove batch.', false)
    }
  }
}

async function handleOrderAction(event) {
  const button = event.target.closest('[data-action="fulfill-order"]')
  if (!button) return
  const card = button.closest('[data-order-id]')
  const orderId = Number(card?.dataset.orderId)
  if (!orderId) return
  try {
    button.disabled = true
    setFeedback('orders', 'Updating order…', true)
    await fetchJson(FULFILLMENT_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'order',
        orderId
      })
    })
    setFeedback('orders', 'Order marked as fulfilled.', true)
    await loadDashboard()
  } catch (error) {
    console.error('Order fulfillment error', error)
    setFeedback('orders', error.message || 'Unable to fulfill order.', false)
  } finally {
    button.disabled = false
  }
}

async function performSubscriptionAction(programId, payload, successMessage) {
  await fetchJson(`/api/farmer/subscriptions/${programId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
  setFeedback('subscriptions', successMessage, true)
  await loadDashboard()
}

async function handleSubscriptionClick(event) {
  const button = event.target.closest('[data-action]')
  if (!button) return
  const card = button.closest('[data-program-id]')
  const programId = Number(card?.dataset.programId)
  if (!programId) return
  const priceInput = card.querySelector('[data-subscription-price]')
  const batchSelect = card.querySelector('[data-subscription-batch]')
  const qtyInput = card.querySelector('[data-subscription-quantity]')
  const dateInput = card.querySelector('[data-subscription-date]')
  const action = button.dataset.action

  try {
    if (action === 'quote') {
      const price = Number(priceInput?.value)
      if (!price || Number.isNaN(price)) {
        setFeedback('subscriptions', 'Enter a quote before sending.', false)
        return
      }
      await performSubscriptionAction(programId, { status: 'QUOTED', price }, 'Quote sent to the customer.')
    } else if (action === 'reject') {
      await performSubscriptionAction(programId, { status: 'CANCELLED' }, 'Subscription request rejected.')
    } else if (action === 'cancel') {
      await performSubscriptionAction(programId, { status: 'CANCELLED' }, 'Subscription cancelled.')
    } else if (action === 'fulfill-subscription') {
      const batchId = Number(batchSelect?.value)
      const quantity = Number(qtyInput?.value)
      if (!batchId || Number.isNaN(batchId)) {
        setFeedback('subscriptions', 'Select a batch before fulfilling.', false)
        return
      }
      if (!quantity || Number.isNaN(quantity)) {
        setFeedback('subscriptions', 'Enter a valid quantity.', false)
        return
      }
      setFeedback('subscriptions', 'Recording shipment…', true)
      await fetchJson(FULFILLMENT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'subscription',
          programId,
          batchId,
          quantity,
          dueDate: dateInput?.value || undefined
        })
      })
      setFeedback('subscriptions', 'Subscription fulfillment recorded.', true)
      await loadDashboard()
    }
  } catch (error) {
    console.error('Subscription action error', error)
    setFeedback('subscriptions', error.message || 'Unable to update subscription.', false)
  }
}

async function submitOfferingForm(event) {
  event.preventDefault()
  const form = event.currentTarget
  const productSelect = $(selectors.offeringProductSelect)
  const modeInput = form.querySelector(selectors.offeringProductMode)
  const mode = modeInput?.value || 'existing'
  const productId = Number(productSelect?.value)
  const population = Number(form.population.value)
  const populationUnit = form.populationUnit.value?.trim()
  if (Number.isNaN(population) || population < 0) {
    setFeedback('offerings', 'Enter a valid population.', false)
    return
  }
  if (!populationUnit) {
    setFeedback('offerings', 'Enter a population unit.', false)
    return
  }
  const payload = {
    population,
    populationUnit
  }
  if (mode === 'existing') {
    if (!productId || Number.isNaN(productId)) {
      const hasOptions = hasUsableOptions(productSelect)
      const message = hasOptions
        ? 'Select a product before adding an offering.'
        : 'No products available. Choose “Create new product” instead.'
      setFeedback('offerings', message, false)
      return
    }
    payload.productId = productId
  } else if (mode === 'new') {
    const { error, payload: newProduct } = readNewProductPayload(form)
    if (error) {
      setFeedback('offerings', error, false)
      return
    }
    payload.newProduct = newProduct
  }
  try {
    setFeedback('offerings', 'Adding offering…', true)
    await fetchJson(OFFERINGS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    form.reset()
    applyOfferingFormMode()
    setFeedback('offerings', 'Offering added.', true)
    await loadDashboard()
  } catch (error) {
    console.error('Offering add error', error)
    setFeedback('offerings', error.message || 'Unable to add offering.', false)
  }
}

async function handleOfferingTableClick(event) {
  const button = event.target.closest('[data-action]')
  if (!button) return
  const row = button.closest('[data-offering-row]')
  const productId = Number(row?.dataset.productId)
  if (!productId) return
  if (button.dataset.action === 'update-offering') {
    const popInput = row.querySelector('[data-offering-population]')
    const unitInput = row.querySelector('[data-offering-population-unit]')
    const population = Number(popInput?.value)
    const populationUnit = unitInput?.value?.trim()
    if (Number.isNaN(population) || population < 0) {
      setFeedback('offerings', 'Enter a valid population.', false)
      return
    }
    if (!populationUnit) {
      setFeedback('offerings', 'Enter a population unit.', false)
      return
    }
    try {
      await fetchJson(`${OFFERINGS_ENDPOINT}/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ population, populationUnit })
      })
      setFeedback('offerings', 'Offering updated.', true)
      await loadDashboard()
    } catch (error) {
      console.error('Offering update error', error)
      setFeedback('offerings', error.message || 'Unable to update offering.', false)
    }
  } else if (button.dataset.action === 'delete-offering') {
    if (!window.confirm('Remove this offering?')) {
      return
    }
    try {
      await fetchJson(`${OFFERINGS_ENDPOINT}/${productId}`, { method: 'DELETE' })
      setFeedback('offerings', 'Offering removed.', true)
      await loadDashboard()
    } catch (error) {
      console.error('Offering delete error', error)
      setFeedback('offerings', error.message || 'Unable to remove offering.', false)
    }
  }
}

function bindEvents() {
  const refreshButton = $(selectors.refreshButton)
  if (refreshButton) {
    refreshButton.addEventListener('click', loadDashboard)
  }
  const inventoryForm = $(selectors.inventoryForm)
  if (inventoryForm) {
    inventoryForm.addEventListener('submit', submitInventoryForm)
  }
  const inventoryProducts = $(selectors.inventoryProducts)
  if (inventoryProducts) {
    inventoryProducts.addEventListener('click', handleInventoryCardClick)
    inventoryProducts.addEventListener('change', handleBatchSelectChange)
  }
  const orderList = $(selectors.orderList)
  if (orderList) {
    orderList.addEventListener('click', handleOrderAction)
  }
  const subscriptionList = $(selectors.subscriptionList)
  if (subscriptionList) {
    subscriptionList.addEventListener('click', handleSubscriptionClick)
  }
  const offeringForm = $(selectors.offeringForm)
  if (offeringForm) {
    offeringForm.addEventListener('submit', submitOfferingForm)
  }
  const offeringTable = $(selectors.offeringTable)
  if (offeringTable) {
    offeringTable.addEventListener('click', handleOfferingTableClick)
  }
  const reportForm = $(selectors.reports.form)
  if (reportForm) {
    reportForm.addEventListener('submit', submitReportForm)
  }
  const reportList = $(selectors.reports.list)
  if (reportList) {
    reportList.addEventListener('click', handleReportListClick)
  }
  const reportClear = $(selectors.reportClearButton)
  if (reportClear) {
    reportClear.addEventListener('click', handleReportClear)
  }
  const reportRefresh = $(selectors.reportRefreshButton)
  if (reportRefresh) {
    reportRefresh.addEventListener('click', loadReportOptions)
  }
  document.querySelectorAll(selectors.tabs.buttons).forEach((button) => {
    button.addEventListener('click', handleTabButtonClick)
  })
}

function configureInventoryForm() {
  const form = $(selectors.inventoryForm)
  const expInput = form?.querySelector('input[name="expDate"]')
  if (!expInput) return
  const enforceMin = () => {
    expInput.min = todayInputValue()
  }
  enforceMin()
  expInput.addEventListener('focus', enforceMin)
}

function configureOfferingForm() {
  const form = $(selectors.offeringForm)
  if (!form) return
  const modeInput = form.querySelector(selectors.offeringProductMode)
  if (modeInput) {
    modeInput.addEventListener('change', applyOfferingFormMode)
  }
  form.addEventListener('reset', () => {
    window.setTimeout(applyOfferingFormMode, 0)
  })
  applyOfferingFormMode()
}

function init() {
  bindEvents()
  configureInventoryForm()
  configureOfferingForm()
  setActiveTab('operations')
  setReportFormDefaults({ reset: true })
  loadDashboard()
  loadReportOptions()
}

document.addEventListener('DOMContentLoaded', init)
