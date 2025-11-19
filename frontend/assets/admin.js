const OVERVIEW_ENDPOINT = '/api/admin/overview'
const ENTITY_ENDPOINT = '/api/admin/entities'
const LOGIN_REDIRECT = '/login.html#admin'

const selectors = {
  alert: '[data-admin-alert]',
  sections: '[data-admin-sections]',
  refreshButton: '[data-refresh-admin]',
  insights: '[data-admin-insights]',
  entityNav: '[data-entity-nav]',
  entityFilterInput: '[data-entity-filter-input]',
  expandEntities: '[data-expand-entities]',
  collapseEntities: '[data-collapse-entities]',
  searchResults: '[data-entity-search-results]',
  searchResultsList: '[data-entity-search-list]',
  searchResultsCount: '[data-search-results-count]'
}

const state = {
  metadata: {},
  data: {},
  ui: {
    searchQuery: '',
    activeEntity: null
  }
}

function formatNumber(value, options = {}) {
  const formatter = new Intl.NumberFormat('en', {
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
    minimumFractionDigits: options.minimumFractionDigits ?? 0
  })
  const numeric = Number(value)
  return formatter.format(Number.isFinite(numeric) ? numeric : 0)
}

function toNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function safeLower(value) {
  return String(value || '').trim().toLowerCase()
}

function escapeSelector(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value)
  }
  return String(value).replace(/([!\"#$%&'()*+,./:;<=>?@[\]^`{|}~\\])/g, '\\$1')
}

function $(selector) {
  return document.querySelector(selector)
}

function computeAdminInsights() {
  const clients = state.data.clients || []
  const orders = state.data.orders || []
  const inventory = state.data.inventory || []
  const subscriptions = state.data.subscriptions || []

  const loyaltyTotal = clients.reduce((sum, client) => sum + toNumber(client.loyalty_points), 0)
  const avgLoyalty = clients.length ? loyaltyTotal / clients.length : 0
  const openOrders = orders.filter((order) => !order.shipped_date).length
  const dueSoonOrders = orders.filter((order) => {
    if (!order.due_by) return false
    const dueDate = new Date(order.due_by)
    if (Number.isNaN(dueDate.getTime())) return false
    const diff = dueDate.getTime() - Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    return diff <= sevenDays && diff >= 0
  }).length
  const lowInventory = inventory.filter((batch) => toNumber(batch.quantity) <= 5).length
  const inventoryWeight = inventory.reduce((sum, batch) => sum + toNumber(batch.weight), 0)
  const activeSubscriptions = subscriptions.filter((sub) => safeLower(sub.status) === 'active').length
  const pausedSubscriptions = subscriptions.length - activeSubscriptions

  return [
    {
      label: 'Clients on file',
      value: formatNumber(clients.length),
      meta: [`${formatNumber(loyaltyTotal)} loyalty pts banked`, `Avg ${formatNumber(avgLoyalty, { maximumFractionDigits: 1 })} pts/client`]
    },
    {
      label: 'Orders monitor',
      value: `${formatNumber(openOrders)} open`,
      meta: [
        dueSoonOrders
          ? `${formatNumber(dueSoonOrders)} due in 7 days`
          : 'All orders comfortably scheduled'
      ]
    },
    {
      label: 'Inventory pulse',
      value: `${formatNumber(inventory.length)} batches`,
      meta: [
        `${formatNumber(lowInventory)} low stock alerts`,
        `${formatNumber(inventoryWeight)} total kg`
      ]
    },
    {
      label: 'Subscriptions',
      value: `${formatNumber(activeSubscriptions)} active`,
      meta: [`${formatNumber(pausedSubscriptions)} paused`, `${formatNumber(subscriptions.length)} total programs`]
    }
  ]
}

function renderInsights() {
  const container = $(selectors.insights)
  if (!container) return
  container.innerHTML = ''
  const insights = computeAdminInsights()
  insights.forEach((item) => {
    const card = document.createElement('div')
    card.className = 'insight-card'

    const label = document.createElement('span')
    label.className = 'muted-text'
    label.textContent = item.label
    card.appendChild(label)

    const value = document.createElement('div')
    value.className = 'insight-card__value'
    value.textContent = item.value
    card.appendChild(value)

    if (item.meta?.length) {
      const metaWrapper = document.createElement('div')
      metaWrapper.className = 'insight-card__meta'
      item.meta.forEach((metaText) => {
        const chip = document.createElement('span')
        chip.textContent = metaText
        metaWrapper.appendChild(chip)
      })
      card.appendChild(metaWrapper)
    }

    container.appendChild(card)
  })
}

function setGlobalAlert(message, isSuccess = false) {
  const el = $(selectors.alert)
  if (!el) return
  el.textContent = message || ''
  el.classList.toggle('success', Boolean(isSuccess))
}

function setEntityStatus(entity, message, isSuccess = false) {
  const el = document.querySelector(`[data-entity-status="${entity}"]`)
  if (!el) return
  el.textContent = message || ''
  el.classList.toggle('success', Boolean(isSuccess))
}

function renderEntityNav() {
  const nav = $(selectors.entityNav)
  if (!nav) return
  nav.innerHTML = ''
  const entries = Object.entries(state.metadata)
  if (!entries.length) return
  entries
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .forEach(([key, meta]) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = meta.label
      button.dataset.entityNavButton = key
      button.dataset.entityLabel = safeLower(`${meta.label} ${key}`)
      nav.appendChild(button)
    })
  updateEntityNavActiveState()
}

function scrollToEntity(entityKey) {
  const card = document.querySelector(`[data-entity-card="${entityKey}"]`)
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function updateEntityVisibility() {
  const focusedEntity = state.ui.activeEntity
  document.querySelectorAll('[data-entity-card]').forEach((card) => {
    const matchesFocus = !focusedEntity || card.dataset.entityCard === focusedEntity
    card.style.display = matchesFocus ? '' : 'none'
  })
  updateEntityNavActiveState()
}

function updateEntityNavActiveState() {
  const nav = $(selectors.entityNav)
  if (!nav) return
  nav.querySelectorAll('[data-entity-nav-button]').forEach((button) => {
    button.classList.toggle('active', Boolean(state.ui.activeEntity) && button.dataset.entityNavButton === state.ui.activeEntity)
  })
}

function setEntityFocus(entityKey) {
  state.ui.activeEntity = entityKey
  updateEntityVisibility()
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  })
  if (response.status === 401) {
    window.location.href = LOGIN_REDIRECT
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

function buildTable(entityKey, meta, rows) {
  const wrapper = document.createElement('div')
  wrapper.className = 'table-wrapper'
  const table = document.createElement('table')
  table.dataset.entityTable = entityKey
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  meta.fields.forEach((field) => {
    const th = document.createElement('th')
    th.textContent = field.label
    headRow.appendChild(th)
  })
  thead.appendChild(headRow)
  table.appendChild(thead)
  const tbody = document.createElement('tbody')
  if (!rows.length) {
    const emptyRow = document.createElement('tr')
    emptyRow.dataset.emptyRow = 'true'
    const cell = document.createElement('td')
    cell.colSpan = meta.fields.length
    cell.textContent = 'No data found.'
    emptyRow.appendChild(cell)
    tbody.appendChild(emptyRow)
  } else {
    rows.forEach((row) => {
      const tr = document.createElement('tr')
      meta.fields.forEach((field) => {
        const td = document.createElement('td')
        const value = row[field.column]
        td.textContent = value == null ? '—' : value
        tr.appendChild(td)
      })
      const rowId = getEntityRowIdentifier(meta, row)
      if (rowId) {
        tr.dataset.entityRowId = String(rowId)
      }
      tbody.appendChild(tr)
    })
  }
  table.appendChild(tbody)
  wrapper.appendChild(table)
  return wrapper
}

function buildFieldInputs(meta, { skipPrimary, prefix } = {}) {
  const fragment = document.createDocumentFragment()
  const grid = document.createElement('div')
  grid.className = 'grid'
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(160px, 1fr))'
  meta.fields.forEach((field) => {
    if (skipPrimary && meta.primaryKey.includes(field.column)) {
      return
    }
    const formGroup = document.createElement('div')
    formGroup.className = 'form-group'
    const label = document.createElement('label')
    label.textContent = field.label
    const input = document.createElement('input')
    input.dataset.fieldInput = field.column
    if (field.type === 'number') {
      input.type = 'number'
      input.step = 'any'
    } else if (field.type === 'date') {
      input.type = 'date'
    } else {
      input.type = 'text'
    }
    if (field.readOnly) {
      input.readOnly = true
    }
    if (prefix === 'update') {
      input.placeholder = 'Leave blank to skip'
    }
    formGroup.appendChild(label)
    formGroup.appendChild(input)
    grid.appendChild(formGroup)
  })
  fragment.appendChild(grid)
  return fragment
}

function buildIdInput(meta, labelText) {
  const formGroup = document.createElement('div')
  formGroup.className = 'form-group'
  const label = document.createElement('label')
  label.textContent = labelText
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = meta.primaryKey.length > 1 ? 'Use key1:key2' : 'Primary key'
  input.dataset.recordId = 'true'
  formGroup.appendChild(label)
  formGroup.appendChild(input)
  return formGroup
}

function getEntityQuickFact(entityKey, rows) {
  if (!rows.length) {
    return 'No records yet — add your first entry.'
  }
  if (entityKey === 'orders') {
    const awaiting = rows.filter((row) => !row.shipped_date).length
    return awaiting ? `${awaiting} awaiting shipment` : 'All orders fulfilled'
  }
  if (entityKey === 'inventory') {
    const low = rows.filter((row) => toNumber(row.quantity) <= 5).length
    return low ? `${low} low-stock batches` : 'Inventory looks healthy'
  }
  if (entityKey === 'subscriptions') {
    const active = rows.filter((row) => safeLower(row.status) === 'active').length
    return `${active} active subscriptions`
  }
  if (entityKey === 'clients') {
    const top = rows.reduce((max, row) => Math.max(max, toNumber(row.loyalty_points)), 0)
    return `Top loyalty balance: ${formatNumber(top)} pts`
  }
  return 'Sorted by latest records'
}

function getEntityRowIdentifier(meta, row) {
  if (!meta.primaryKey?.length) return null
  const parts = meta.primaryKey.map((column) => row[column])
  if (parts.some((value) => value === undefined || value === null || value === '')) {
    return null
  }
  return parts.join(':')
}

function computeUniversalSearchResults(query) {
  const normalized = safeLower(query)
  if (!normalized) return []
  const results = []
  const maxResults = 20
  Object.entries(state.metadata).forEach(([entityKey, meta]) => {
    const rows = state.data[entityKey] || []
    const entityTokens = safeLower(`${meta.label} ${entityKey}`)
    if (entityTokens.includes(normalized)) {
      results.push({
        type: 'table',
        entityKey,
        title: meta.label,
        detail: `${rows.length} record${rows.length === 1 ? '' : 's'}`
      })
    }
    meta.fields.forEach((field) => {
      const fieldTokens = safeLower(`${field.label} ${field.column}`)
      if (fieldTokens.includes(normalized)) {
        results.push({
          type: 'column',
          entityKey,
          title: `${field.label} (${meta.label})`,
          detail: `Column: ${field.column}`
        })
      }
    })
    let rowMatches = 0
    const rowMatchLimit = 4
    for (const row of rows) {
      if (rowMatches >= rowMatchLimit || results.length >= maxResults) {
        break
      }
      const rowValues = Object.values(row)
      const rowText = safeLower(rowValues.join(' '))
      if (!rowText.includes(normalized)) {
        continue
      }
      rowMatches += 1
      const rowId = getEntityRowIdentifier(meta, row)
      const matchedField = meta.fields.find((field) => {
        const value = row[field.column]
        return value != null && safeLower(String(value)).includes(normalized)
      })
      const detail = matchedField
        ? `${matchedField.label}: ${row[matchedField.column]}`
        : 'Record matched search text.'
      results.push({
        type: 'row',
        entityKey,
        rowId,
        title: rowId ? `${meta.label} · ${rowId}` : `${meta.label} record`,
        detail
      })
    }
  })
  return results.slice(0, maxResults)
}

function renderSearchResults() {
  const container = $(selectors.searchResults)
  const list = $(selectors.searchResultsList)
  const counter = $(selectors.searchResultsCount)
  if (!container || !list || !counter) return
  const query = safeLower(state.ui.searchQuery)
  if (!query) {
    container.hidden = true
    counter.textContent = '0 matches'
    list.innerHTML = ''
    return
  }
  const results = computeUniversalSearchResults(query)
  counter.textContent = `${results.length} match${results.length === 1 ? '' : 'es'}`
  list.innerHTML = ''
  if (results.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'search-results__empty muted-text'
    empty.textContent = 'No tables, columns, or rows match your search.'
    list.appendChild(empty)
  } else {
    results.forEach((result) => {
      const item = document.createElement('li')
      item.className = 'search-results__item'
      item.dataset.searchResult = 'true'
      item.dataset.resultType = result.type
      item.dataset.resultEntity = result.entityKey
      if (result.rowId) {
        item.dataset.resultRowId = result.rowId
      }

      const metaWrapper = document.createElement('div')
      metaWrapper.className = 'search-results__meta'
      const typeLabel = document.createElement('span')
      typeLabel.className = 'search-result__type'
      typeLabel.textContent =
        result.type === 'row' ? 'Row match' : result.type === 'column' ? 'Column match' : 'Table'
      const title = document.createElement('p')
      title.className = 'search-result__title'
      title.textContent = result.title
      const detail = document.createElement('p')
      detail.className = 'search-result__detail'
      detail.textContent = result.detail
      metaWrapper.appendChild(typeLabel)
      metaWrapper.appendChild(title)
      metaWrapper.appendChild(detail)

      const jump = document.createElement('span')
      jump.className = 'search-results__entity'
      jump.textContent = 'Go to table →'

      item.appendChild(metaWrapper)
      item.appendChild(jump)
      list.appendChild(item)
    })
  }
  container.hidden = false
}

function focusEntityRow(entityKey, rowId) {
  if (!rowId) return
  const selector = `[data-entity-card="${entityKey}"] table[data-entity-table="${entityKey}"] [data-entity-row-id="${escapeSelector(rowId)}"]`
  const row = document.querySelector(selector)
  if (!row) return
  row.scrollIntoView({ behavior: 'smooth', block: 'center' })
  row.classList.add('entity-row--highlight')
  window.setTimeout(() => {
    row.classList.remove('entity-row--highlight')
  }, 2000)
}

function renderEntityCard(entityKey, meta, rows) {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.entityCard = entityKey
  card.dataset.entityLabel = safeLower(meta.label)
  const fieldTokens = meta.fields.map((field) => `${field.label} ${field.column}`)
  card.dataset.entitySearchTokens = safeLower(`${meta.label} ${entityKey} ${fieldTokens.join(' ')}`)

  const header = document.createElement('div')
  header.style.display = 'flex'
  header.style.justifyContent = 'space-between'
  header.style.flexWrap = 'wrap'
  header.style.gap = '1rem'
  const titleWrapper = document.createElement('div')
  const title = document.createElement('h2')
  title.textContent = meta.label
  titleWrapper.appendChild(title)
  const counter = document.createElement('div')
  counter.className = 'entity-card__status'
  counter.innerHTML = `<strong>${rows.length}</strong> records · ${getEntityQuickFact(entityKey, rows)}`
  header.appendChild(titleWrapper)
  header.appendChild(counter)
  card.appendChild(header)

  const tools = document.createElement('div')
  tools.className = 'entity-card__tools'
  const searchInput = document.createElement('input')
  searchInput.type = 'search'
  searchInput.placeholder = 'Search records…'
  searchInput.dataset.entitySearch = entityKey
  tools.appendChild(searchInput)
  const searchFeedback = document.createElement('small')
  searchFeedback.className = 'entity-card__search-feedback'
  searchFeedback.dataset.entitySearchFeedback = entityKey
  searchFeedback.textContent = rows.length ? `Showing all ${rows.length} records.` : 'No records yet.'
  tools.appendChild(searchFeedback)
  card.appendChild(tools)

  card.appendChild(buildTable(entityKey, meta, rows))
  const status = document.createElement('div')
  status.className = 'form-feedback'
  status.dataset.entityStatus = entityKey
  card.appendChild(status)

  // Create form
  const createForm = document.createElement('form')
  createForm.dataset.adminForm = 'true'
  createForm.dataset.entity = entityKey
  createForm.dataset.action = 'create'
  createForm.appendChild(buildFieldInputs(meta, { prefix: 'create' }))
  const createButton = document.createElement('button')
  createButton.type = 'submit'
  createButton.className = 'button'
  createButton.textContent = 'Add record'
  createForm.appendChild(createButton)
  const actionsWrapper = document.createElement('details')
  actionsWrapper.className = 'entity-actions'
  actionsWrapper.open = rows.length <= 5
  actionsWrapper.dataset.entityActions = entityKey
  const summary = document.createElement('summary')
  summary.textContent = 'Modify records'
  actionsWrapper.appendChild(summary)
  const formsContainer = document.createElement('div')
  formsContainer.className = 'entity-card__forms'
  formsContainer.appendChild(createForm)

  // Update form
  const updateForm = document.createElement('form')
  updateForm.dataset.adminForm = 'true'
  updateForm.dataset.entity = entityKey
  updateForm.dataset.action = 'update'
  updateForm.appendChild(buildIdInput(meta, 'Record ID'))
  updateForm.appendChild(buildFieldInputs(meta, { skipPrimary: true, prefix: 'update' }))
  const updateButton = document.createElement('button')
  updateButton.type = 'submit'
  updateButton.className = 'button secondary'
  updateButton.textContent = 'Update record'
  updateForm.appendChild(updateButton)
  formsContainer.appendChild(updateForm)

  // Delete form
  const deleteForm = document.createElement('form')
  deleteForm.dataset.adminForm = 'true'
  deleteForm.dataset.entity = entityKey
  deleteForm.dataset.action = 'delete'
  deleteForm.appendChild(buildIdInput(meta, 'Record ID to delete'))
  const deleteButton = document.createElement('button')
  deleteButton.type = 'submit'
  deleteButton.className = 'button outline'
  deleteButton.textContent = 'Delete record'
  deleteForm.appendChild(deleteButton)
  formsContainer.appendChild(deleteForm)

  actionsWrapper.appendChild(formsContainer)
  card.appendChild(actionsWrapper)

  return card
}

function renderEntities() {
  const container = $(selectors.sections)
  if (!container) return
  container.innerHTML = ''
  Object.entries(state.metadata).forEach(([key, meta]) => {
    const rows = state.data[key] || []
    container.appendChild(renderEntityCard(key, meta, rows))
  })
  renderEntityNav()
  updateEntityVisibility()
  renderSearchResults()
}

async function loadOverview() {
  try {
    setGlobalAlert('Loading admin data…', true)
    const data = await fetchJson(OVERVIEW_ENDPOINT)
    if (!data) return
    state.metadata = data.metadata || {}
    state.data = data.data || {}
    renderInsights()
    renderEntities()
    setGlobalAlert(data.line || 'Data synchronized.', true)
  } catch (error) {
    console.error('Admin overview load error', error)
    setGlobalAlert(error.message || 'Unable to load admin data.', false)
  }
}

function collectFieldValues(form, { skipEmpty = false } = {}) {
  const values = {}
  form.querySelectorAll('[data-field-input]').forEach((input) => {
    const column = input.dataset.fieldInput
    if (!column) return
    const raw = input.value
    if (raw === '' && skipEmpty) {
      return
    }
    if (raw === '') {
      values[column] = null
    } else if (input.type === 'number') {
      values[column] = Number(input.value)
    } else {
      values[column] = input.value
    }
  })
  return values
}

function getRecordId(form) {
  const input = form.querySelector('[data-record-id="true"]')
  if (!input) return null
  const value = input.value.trim()
  return value || null
}

function setEntitySearchFeedback(entityKey, message) {
  const el = document.querySelector(`[data-entity-search-feedback="${entityKey}"]`)
  if (el) {
    el.textContent = message
  }
}

function filterEntityTableRows(entityKey, query = '') {
  const normalizedQuery = safeLower(query)
  const table = document.querySelector(`[data-entity-card="${entityKey}"] table[data-entity-table="${entityKey}"]`)
  if (!table) return
  const rows = Array.from(table.querySelectorAll('tbody tr'))
  let visibleRows = 0
  rows.forEach((row) => {
    if (row.dataset.emptyRow === 'true') {
      row.style.display = normalizedQuery ? 'none' : ''
      return
    }
    const text = safeLower(row.textContent || '')
    const match = !normalizedQuery || text.includes(normalizedQuery)
    row.style.display = match ? '' : 'none'
    if (match) {
      visibleRows += 1
    }
  })
  const totalRows = rows.length ? rows.filter((row) => row.dataset.emptyRow !== 'true').length : 0
  if (!normalizedQuery) {
    if (totalRows === 0) {
      setEntitySearchFeedback(entityKey, 'No records yet.')
    } else {
      setEntitySearchFeedback(entityKey, `Showing all ${totalRows} records.`)
    }
  } else if (visibleRows === 0) {
    setEntitySearchFeedback(entityKey, 'No rows match your search.')
  } else {
    setEntitySearchFeedback(entityKey, `Showing ${visibleRows} matching record(s).`)
  }
}

async function handleAdminFormSubmit(event) {
  const form = event.target.closest('[data-admin-form]')
  if (!form) return
  event.preventDefault()
  const entity = form.dataset.entity
  const action = form.dataset.action
  setEntityStatus(entity, 'Submitting…', true)
  try {
    if (action === 'create') {
      const values = collectFieldValues(form)
      await fetchJson(ENTITY_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ entity, values })
      })
    } else if (action === 'update') {
      const recordId = getRecordId(form)
      if (!recordId) {
        setEntityStatus(entity, 'Record ID is required for updates.', false)
        return
      }
      const values = collectFieldValues(form, { skipEmpty: true })
      if (Object.keys(values).length === 0) {
        setEntityStatus(entity, 'Provide at least one field to update.', false)
        return
      }
      await fetchJson(`${ENTITY_ENDPOINT}/${entity}/${encodeURIComponent(recordId)}`, {
        method: 'PUT',
        body: JSON.stringify({ values })
      })
    } else if (action === 'delete') {
      const recordId = getRecordId(form)
      if (!recordId) {
        setEntityStatus(entity, 'Record ID is required for deletion.', false)
        return
      }
      await fetchJson(`${ENTITY_ENDPOINT}/${entity}/${encodeURIComponent(recordId)}`, {
        method: 'DELETE'
      })
    }
    setEntityStatus(entity, 'Operation successful.', true)
    await loadOverview()
  } catch (error) {
    console.error('Admin form error', error)
    setEntityStatus(entity, error.message || 'Request failed.', false)
  }
}

function handleEntityNavClick(event) {
  const button = event.target.closest('[data-entity-nav-button]')
  if (!button) return
  const entity = button.dataset.entityNavButton
  if (!entity) return
  const nextFocus = state.ui.activeEntity === entity ? null : entity
  setEntityFocus(nextFocus)
  if (nextFocus) {
    scrollToEntity(nextFocus)
  } else {
    const sections = $(selectors.sections)
    if (sections) {
      sections.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
}

function handleSearchResultsClick(event) {
  const item = event.target.closest('[data-search-result="true"]')
  if (!item) return
  const entity = item.dataset.resultEntity
  if (!entity) return
  setEntityFocus(entity)
  scrollToEntity(entity)
  const rowId = item.dataset.resultRowId
  if (rowId) {
    focusEntityRow(entity, rowId)
  }
}

function handleEntityFilterInput(event) {
  state.ui.searchQuery = event.target.value || ''
  renderSearchResults()
}

function handleEntitySearchInput(event) {
  const input = event.target.closest('[data-entity-search]')
  if (!input) return
  const entity = input.dataset.entitySearch
  filterEntityTableRows(entity, input.value)
}

function expandCollapseEntities(open) {
  document.querySelectorAll('[data-entity-actions]').forEach((details) => {
    details.open = open
  })
}

function handleExpandEntities() {
  expandCollapseEntities(true)
}

function handleCollapseEntities() {
  expandCollapseEntities(false)
}

function bindEvents() {
  const sections = $(selectors.sections)
  if (sections) {
    sections.addEventListener('submit', handleAdminFormSubmit)
    sections.addEventListener('input', handleEntitySearchInput)
  }
  const refreshButton = $(selectors.refreshButton)
  if (refreshButton) {
    refreshButton.addEventListener('click', loadOverview)
  }
  const nav = $(selectors.entityNav)
  if (nav) {
    nav.addEventListener('click', handleEntityNavClick)
  }
  const filterInput = $(selectors.entityFilterInput)
  if (filterInput) {
    filterInput.addEventListener('input', handleEntityFilterInput)
  }
  const searchResults = $(selectors.searchResults)
  if (searchResults) {
    searchResults.addEventListener('click', handleSearchResultsClick)
  }
  const expandButton = $(selectors.expandEntities)
  if (expandButton) {
    expandButton.addEventListener('click', handleExpandEntities)
  }
  const collapseButton = $(selectors.collapseEntities)
  if (collapseButton) {
    collapseButton.addEventListener('click', handleCollapseEntities)
  }
}

function init() {
  bindEvents()
  loadOverview()
}

document.addEventListener('DOMContentLoaded', init)
