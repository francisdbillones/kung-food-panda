const ORDER_OPTIONS_ENDPOINT = '/api/customer/orders/options'

const selectors = {
  loyaltyBalance: '[data-loyalty-balance]',
  catalogGrid: '[data-catalog-grid]',
  catalogEmpty: '[data-catalog-empty]',
  catalogStatus: '[data-catalog-status]',
  pageStatus: '[data-page-status]',
  pagePrev: '[data-page-prev]',
  pageNext: '[data-page-next]',
  filterSearch: '[data-filter-search]',
  filterProduct: '[data-filter-product]',
  filterFarm: '[data-filter-farm]',
  filterGrade: '[data-filter-grade]',
  filterSeason: '[data-filter-season]',
  filterPriceMin: '[data-filter-price-min]',
  filterPriceMax: '[data-filter-price-max]',
  filterWeightMin: '[data-filter-weight-min]',
  filterWeightMax: '[data-filter-weight-max]',
  filterReset: '[data-filter-reset]',
  sortSelect: '[data-sort-select]',
  viewGrid: '[data-view-grid]',
  viewList: '[data-view-list]'
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
  inventory: [],
  filters: {
    search: '',
    product: '',
    farm: '',
    grade: '',
    season: '',
    priceMin: null,
    priceMax: null,
    weightMin: null,
    weightMax: null
  },
  sort: 'alpha-asc',
  view: 'grid',
  page: 1,
  pageSize: 12
}

function $(selector) {
  return document.querySelector(selector)
}

function setText(selector, value) {
  const el = $(selector)
  if (el) el.textContent = value
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0)
}

function formatUnitWeight(value, fallback = 'Weight TBD') {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return `${weightFormatter.format(number)} kg/unit`
}

function setLoyalty(points) {
  setText(selectors.loyaltyBalance, `${points} pts`)
}

function populateFilterOptions() {
  const productSelect = $(selectors.filterProduct)
  const farmSelect = $(selectors.filterFarm)
  const gradeSelect = $(selectors.filterGrade)
  if (productSelect) {
    const products = Array.from(new Set(state.inventory.map((item) => item.productName))).sort()
    productSelect.innerHTML = '<option value="">All products</option>'
    products.forEach((product) => {
      const option = document.createElement('option')
      option.value = product
      option.textContent = product
      productSelect.appendChild(option)
    })
  }
  if (farmSelect) {
    const farms = Array.from(new Set(state.inventory.map((item) => item.farmId))).sort((a, b) => a - b)
    farmSelect.innerHTML = '<option value="">All farms</option>'
    farms.forEach((farmId) => {
      const option = document.createElement('option')
      option.value = farmId
      option.textContent = `Farm #${farmId}`
      farmSelect.appendChild(option)
    })
  }
  if (gradeSelect) {
    const grades = Array.from(new Set(state.inventory.map((item) => item.productGrade))).filter(Boolean).sort()
    gradeSelect.innerHTML = '<option value="">All grades</option>'
    grades.forEach((grade) => {
      const option = document.createElement('option')
      option.value = grade
      option.textContent = grade
      gradeSelect.appendChild(option)
    })
  }
}

function isInSeason(item) {
  if (!item.seasonStart || !item.seasonEnd) return false
  const today = new Date()
  const start = new Date(item.seasonStart)
  const end = new Date(item.seasonEnd)
  return today >= start && today <= end
}

function filterInventory() {
  const {
    search,
    product,
    farm,
    grade,
    season,
    priceMin,
    priceMax,
    weightMin,
    weightMax
  } = state.filters
  return state.inventory.filter((item) => {
    if (product && item.productName !== product) return false
    if (farm && String(item.farmId) !== String(farm)) return false
    if (grade && item.productGrade !== grade) return false
    if (season === 'in-season' && !isInSeason(item)) return false
    if (season === 'off-season' && isInSeason(item)) return false
    if (priceMin != null && item.price < priceMin) return false
    if (priceMax != null && item.price > priceMax) return false
    if (weightMin != null && (item.weight == null || item.weight < weightMin)) return false
    if (weightMax != null && (item.weight == null || item.weight > weightMax)) return false
    if (search) {
      const term = search.toLowerCase()
      const label = `${item.productName} ${item.productType || ''} grade ${item.productGrade || ''} farm #${item.farmId} ${item.farmLocation || ''}`.toLowerCase()
      if (!label.includes(term)) return false
    }
    return true
  })
}

function sortInventory(items) {
  const sorted = [...items]
  switch (state.sort) {
    case 'alpha-desc':
      sorted.sort((a, b) => b.productName.localeCompare(a.productName))
      break
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price)
      break
    case 'exp-asc':
      sorted.sort((a, b) => new Date(a.expDate || '9999-12-31') - new Date(b.expDate || '9999-12-31'))
      break
    case 'exp-desc':
      sorted.sort((a, b) => new Date(b.expDate || '0001-01-01') - new Date(a.expDate || '0001-01-01'))
      break
    case 'weight-asc':
      sorted.sort((a, b) => {
        const aw = a.weight != null ? a.weight : Infinity
        const bw = b.weight != null ? b.weight : Infinity
        const diff = aw - bw
        return Number.isNaN(diff) ? 0 : diff
      })
      break
    case 'weight-desc':
      sorted.sort((a, b) => {
        const aw = a.weight != null ? a.weight : -Infinity
        const bw = b.weight != null ? b.weight : -Infinity
        const diff = bw - aw
        return Number.isNaN(diff) ? 0 : diff
      })
      break
    case 'alpha-asc':
    default:
      sorted.sort((a, b) => a.productName.localeCompare(b.productName))
      break
  }
  return sorted
}

function renderCatalog(items) {
  const grid = $(selectors.catalogGrid)
  const empty = $(selectors.catalogEmpty)
  if (!grid) return
  grid.innerHTML = ''
  if (!items.length) {
    if (empty) empty.hidden = false
    return
  }
  if (empty) empty.hidden = true
  grid.classList.toggle('list-view', state.view === 'list')

  items.forEach((item) => {
    const card = document.createElement('div')
    card.className = 'stock-card'
    if (state.view === 'list') card.classList.add('list-card')
    const title = document.createElement('h3')
    title.textContent = item.productName
    const meta = document.createElement('p')
    meta.textContent = `${item.productType || 'Product'} · Grade ${item.productGrade || '—'}`
    const priceLine = document.createElement('p')
    priceLine.textContent = `${formatCurrency(item.price)} · Farm #${item.farmId}`
    const weightLine = document.createElement('small')
    weightLine.textContent = formatUnitWeight(item.weight)
    const season = document.createElement('small')
    season.textContent = item.seasonStart && item.seasonEnd
      ? `Season: ${item.seasonStart} – ${item.seasonEnd}`
      : 'Season: TBD'
    const location = document.createElement('small')
    location.textContent = item.farmLocation || 'Location TBD'
    const quantity = document.createElement('p')
    quantity.innerHTML = `<strong>${item.quantity}</strong> units remaining`
    const button = document.createElement('a')
    button.className = 'button'
    button.href = `order-checkout.html?batchId=${item.batchId}`
    button.textContent = 'Order this batch'
    card.appendChild(title)
    card.appendChild(meta)
    card.appendChild(priceLine)
    card.appendChild(weightLine)
    card.appendChild(location)
    card.appendChild(season)
    card.appendChild(quantity)
    card.appendChild(button)
    grid.appendChild(card)
  })
}

function updatePagination(startIndex, endIndex, totalItems, totalPages) {
  if (!totalItems) {
    setText(selectors.catalogStatus, 'Showing 0 - 0 of 0 batches')
  } else {
    setText(selectors.catalogStatus, `Showing ${startIndex + 1} - ${endIndex} of ${totalItems} batches`)
  }
  setText(selectors.pageStatus, `Page ${state.page} of ${totalPages}`)
  const prev = $(selectors.pagePrev)
  const next = $(selectors.pageNext)
  if (prev) prev.disabled = state.page <= 1
  if (next) next.disabled = state.page >= totalPages
}

function applyFilters(resetPage = false) {
  if (resetPage) state.page = 1
  const filtered = filterInventory()
  const sorted = sortInventory(filtered)
  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  if (state.page > totalPages) state.page = totalPages
  const start = total ? (state.page - 1) * state.pageSize : 0
  const end = total ? Math.min(total, start + state.pageSize) : 0
  const visible = sorted.slice(start, end)
  renderCatalog(visible)
  updatePagination(start, end, total, totalPages)
}

function attachFilterEvents() {
  const searchInput = $(selectors.filterSearch)
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.filters.search = event.target.value.trim()
      applyFilters(true)
    })
  }
  const productSelect = $(selectors.filterProduct)
  if (productSelect) {
    productSelect.addEventListener('change', (event) => {
      state.filters.product = event.target.value
      applyFilters(true)
    })
  }
  const farmSelect = $(selectors.filterFarm)
  if (farmSelect) {
    farmSelect.addEventListener('change', (event) => {
      state.filters.farm = event.target.value
      applyFilters(true)
    })
  }
  const gradeSelect = $(selectors.filterGrade)
  if (gradeSelect) {
    gradeSelect.addEventListener('change', (event) => {
      state.filters.grade = event.target.value
      applyFilters(true)
    })
  }
  const seasonSelect = $(selectors.filterSeason)
  if (seasonSelect) {
    seasonSelect.addEventListener('change', (event) => {
      state.filters.season = event.target.value
      applyFilters(true)
    })
  }
  const priceMin = $(selectors.filterPriceMin)
  const priceMax = $(selectors.filterPriceMax)
  const weightMin = $(selectors.filterWeightMin)
  const weightMax = $(selectors.filterWeightMax)
  if (priceMin) {
    priceMin.addEventListener('input', (event) => {
      const value = Number(event.target.value)
      state.filters.priceMin = Number.isNaN(value) ? null : value
      applyFilters(true)
    })
  }
  if (priceMax) {
    priceMax.addEventListener('input', (event) => {
      const value = Number(event.target.value)
      state.filters.priceMax = Number.isNaN(value) ? null : value
      applyFilters(true)
    })
  }
  if (weightMin) {
    weightMin.addEventListener('input', (event) => {
      const value = Number(event.target.value)
      state.filters.weightMin = Number.isNaN(value) ? null : value
      applyFilters(true)
    })
  }
  if (weightMax) {
    weightMax.addEventListener('input', (event) => {
      const value = Number(event.target.value)
      state.filters.weightMax = Number.isNaN(value) ? null : value
      applyFilters(true)
    })
  }
  const resetButton = $(selectors.filterReset)
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      state.filters = {
        search: '',
        product: '',
        farm: '',
        grade: '',
        season: '',
        priceMin: null,
        priceMax: null,
        weightMin: null,
        weightMax: null
      }
      if (searchInput) searchInput.value = ''
      if (productSelect) productSelect.value = ''
      if (farmSelect) farmSelect.value = ''
      if (gradeSelect) gradeSelect.value = ''
      if (seasonSelect) seasonSelect.value = ''
      if (priceMin) priceMin.value = ''
      if (priceMax) priceMax.value = ''
      if (weightMin) weightMin.value = ''
      if (weightMax) weightMax.value = ''
      applyFilters(true)
    })
  }
  const sortSelect = $(selectors.sortSelect)
  if (sortSelect) {
    sortSelect.addEventListener('change', (event) => {
      state.sort = event.target.value
      applyFilters()
    })
  }
  const viewGrid = $(selectors.viewGrid)
  const viewList = $(selectors.viewList)
  if (viewGrid) {
    viewGrid.addEventListener('click', () => {
      state.view = 'grid'
      viewGrid.classList.add('active')
      if (viewList) viewList.classList.remove('active')
      applyFilters()
    })
  }
  if (viewList) {
    viewList.addEventListener('click', () => {
      state.view = 'list'
      viewList.classList.add('active')
      if (viewGrid) viewGrid.classList.remove('active')
      applyFilters()
    })
  }
  const prev = $(selectors.pagePrev)
  const next = $(selectors.pageNext)
  if (prev) {
    prev.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1
        applyFilters()
      }
    })
  }
  if (next) {
    next.addEventListener('click', () => {
      state.page += 1
      applyFilters()
    })
  }
}

async function loadCatalog() {
  try {
    const response = await fetch(ORDER_OPTIONS_ENDPOINT, { credentials: 'include' })
    if (response.status === 401) {
      window.location.href = '/login.html#customer'
      return
    }
    if (!response.ok) {
      throw new Error('Failed to load inventory.')
    }
    const data = await response.json()
    state.inventory = (data.inventory || []).map((item) => ({
      batchId: item.batchId,
      productName: item.productName,
      productType: item.productType,
      productGrade: item.productGrade,
      seasonStart: item.seasonStart,
      seasonEnd: item.seasonEnd,
      expDate: item.expDate,
      farmId: item.farmId,
      price: Number(item.price),
      quantity: Number(item.quantity) || 0,
      farmLocation: item.farmLocation,
      weight: item.weight != null ? Number(item.weight) : null
    }))
    state.page = 1
    setLoyalty(Number(data.profile?.loyaltyPoints) || 0)
    populateFilterOptions()
    applyFilters(true)
  } catch (error) {
    console.error('Catalog load error', error)
    setLoyalty(0)
    const grid = $(selectors.catalogGrid)
    if (grid) grid.innerHTML = ''
    const empty = $(selectors.catalogEmpty)
    if (empty) {
      empty.hidden = false
      empty.textContent = error.message || 'Unable to load inventory.'
    }
    setText(selectors.catalogStatus, 'Showing 0 - 0 of 0 batches')
    setText(selectors.pageStatus, 'Page 1 of 1')
  }
}

function initPage() {
  attachFilterEvents()
  loadCatalog()
}

document.addEventListener('DOMContentLoaded', initPage)
