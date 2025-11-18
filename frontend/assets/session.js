const SESSION_ENDPOINT = '/api/session'
const LOGOUT_ENDPOINT = '/api/logout'

const navSelectors = {
  items: '[data-visible-roles]',
  logoutButtons: '[data-logout]',
  userLabel: '[data-user-label]'
}

const roleState = {
  role: 'guest',
  profile: null
}

function parseVisibleRoles(value) {
  if (!value) return null
  return value.split(',').map((token) => token.trim()).filter(Boolean)
}

function roleMatches(roles, currentRole) {
  if (!roles || roles.length === 0) return true
  if (roles.includes('all')) return true
  return roles.includes(currentRole)
}

function updateNavVisibility() {
  const role = roleState.role || 'guest'
  document.querySelectorAll(navSelectors.items).forEach((element) => {
    const roles = parseVisibleRoles(element.dataset.visibleRoles)
    const shouldShow = roleMatches(roles, role)
    element.hidden = !shouldShow
  })
  const label = document.querySelector(navSelectors.userLabel)
  if (label) {
    if (role === 'guest') {
      label.textContent = 'Not signed in'
    } else if (role === 'customer') {
      label.textContent = `Customer #${roleState.profile?.customerId || ''}`
    } else if (role === 'farmer') {
      label.textContent = `Farmer #${roleState.profile?.farmId || ''}`
    } else if (role === 'admin') {
      label.textContent = 'Administrator'
    } else {
      label.textContent = ''
    }
  }
}

async function fetchSession() {
  try {
    const response = await fetch(SESSION_ENDPOINT, { credentials: 'include' })
    if (!response.ok) {
      throw new Error('No session')
    }
    const data = await response.json()
    roleState.role = data.profile?.role || 'guest'
    roleState.profile = data.profile || null
  } catch (error) {
    roleState.role = 'guest'
    roleState.profile = null
  } finally {
    updateNavVisibility()
  }
}

async function handleLogout(event) {
  event.preventDefault()
  try {
    await fetch(LOGOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    })
  } finally {
    roleState.role = 'guest'
    roleState.profile = null
    updateNavVisibility()
    window.location.href = '/login.html'
  }
}

function attachNavHandlers() {
  document.querySelectorAll(navSelectors.logoutButtons).forEach((button) => {
    button.addEventListener('click', handleLogout)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  attachNavHandlers()
  updateNavVisibility()
  fetchSession()
})
