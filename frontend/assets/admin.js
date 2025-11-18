const OVERVIEW_ENDPOINT = '/api/admin/overview'
const ENTITY_ENDPOINT = '/api/admin/entities'
const LOGIN_REDIRECT = '/login.html#admin'

const selectors = {
  alert: '[data-admin-alert]',
  sections: '[data-admin-sections]',
  refreshButton: '[data-refresh-admin]'
}

const state = {
  metadata: {},
  data: {}
}

function $(selector) {
  return document.querySelector(selector)
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

function buildTable(meta, rows) {
  const wrapper = document.createElement('div')
  wrapper.className = 'table-wrapper'
  const table = document.createElement('table')
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

function renderEntityCard(entityKey, meta, rows) {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.entityCard = entityKey

  const header = document.createElement('div')
  header.style.display = 'flex'
  header.style.justifyContent = 'space-between'
  header.style.flexWrap = 'wrap'
  header.style.gap = '1rem'
  const titleWrapper = document.createElement('div')
  const title = document.createElement('h2')
  title.textContent = meta.label
  titleWrapper.appendChild(title)
  const counter = document.createElement('span')
  counter.innerHTML = `<strong>${rows.length}</strong> records`
  header.appendChild(titleWrapper)
  header.appendChild(counter)
  card.appendChild(header)

  card.appendChild(buildTable(meta, rows))
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
  card.appendChild(createForm)

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
  card.appendChild(updateForm)

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
  card.appendChild(deleteForm)

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
}

async function loadOverview() {
  try {
    setGlobalAlert('Loading admin data…', true)
    const data = await fetchJson(OVERVIEW_ENDPOINT)
    if (!data) return
    state.metadata = data.metadata || {}
    state.data = data.data || {}
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

function bindEvents() {
  const sections = $(selectors.sections)
  if (sections) {
    sections.addEventListener('submit', handleAdminFormSubmit)
  }
  const refreshButton = $(selectors.refreshButton)
  if (refreshButton) {
    refreshButton.addEventListener('click', loadOverview)
  }
}

function init() {
  bindEvents()
  loadOverview()
}

document.addEventListener('DOMContentLoaded', init)
