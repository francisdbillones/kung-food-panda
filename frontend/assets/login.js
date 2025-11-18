const LOGIN_FORM_SELECTOR = '[data-login-form]'
const FEEDBACK_CLASS = 'form-feedback'
const SESSION_STATUS_ENDPOINT = '/api/session'

const ROLE_CONFIG = {
  customer: {
    endpoint: '/api/login/customer',
    redirect: '/customer-dashboard.html',
    label: 'Customer ID',
    field: 'customerId',
    placeholder: 'e.g. 1001',
    description: 'Access dashboards, orders, and subscriptions using your customer ID.',
    buttonText: 'Sign in as customer'
  },
  farmer: {
    endpoint: '/api/login/farmer',
    redirect: '/farmer-console.html',
    label: 'Farm ID',
    field: 'farmId',
    placeholder: 'e.g. FARM-001',
    description: 'Manage inventory, offerings, and subscription fulfillments for your farm.',
    buttonText: 'Sign in as farmer'
  },
  admin: {
    endpoint: '/api/login/admin',
    redirect: '/admin-console.html',
    label: 'Admin ID',
    field: 'adminId',
    placeholder: 'ADMIN-001',
    defaultValue: 'ADMIN-001',
    description: 'Unlock full CRUD access across clients, farms, orders, subscriptions, and more.',
    buttonText: 'Enter admin portal'
  }
}

function serializeForm(form) {
  const formData = new FormData(form)
  const payload = {}
  for (const [key, value] of formData.entries()) {
    if (value !== undefined && value !== null) {
      payload[key] = value.trim ? value.trim() : value
    }
  }
  return payload
}

function showFeedback(container, message, isSuccess) {
  if (!container) return
  container.textContent = message || ''
  container.classList.toggle('success', Boolean(isSuccess))
}

function applyRoleConfig(role) {
  const form = document.querySelector(LOGIN_FORM_SELECTOR)
  if (!form) return
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.customer
  form.dataset.endpoint = config.endpoint
  if (config.redirect) {
    form.dataset.redirect = config.redirect
  } else {
    delete form.dataset.redirect
  }
  const label = form.querySelector('[data-login-label]')
  if (label) {
    label.textContent = config.label
  }
  const input = form.querySelector('[data-login-input]')
  if (input) {
    input.name = config.field
    input.placeholder = config.placeholder || ''
    input.value = config.defaultValue || ''
    input.type = config.inputType || 'text'
    input.required = true
  }
  const description = form.closest('.auth-card')?.querySelector('[data-role-description]') || document.querySelector('[data-role-description]')
  if (description) {
    description.textContent = config.description || ''
  }
  const button = form.querySelector('[data-login-submit]')
  if (button) {
    button.textContent = config.buttonText || 'Sign in'
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault()
  const form = event.currentTarget
  const endpoint = form.dataset.endpoint
  const redirect = form.dataset.redirect
  const feedback = form.querySelector(`.${FEEDBACK_CLASS}`)

  if (!endpoint) {
    showFeedback(feedback, 'Missing endpoint configuration.')
    return
  }

  showFeedback(feedback, 'Signing in…', true)

  try {
    const body = JSON.stringify(serializeForm(form))
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const msg = data.error || data.line || 'Login failed. Please verify your ID.'
      showFeedback(feedback, msg, false)
      return
    }

    showFeedback(feedback, data.line || 'Login successful.', true)
    if (redirect) {
      setTimeout(() => {
        window.location.href = redirect
      }, 600)
    }
  } catch (error) {
    console.error('Login error', error)
    showFeedback(feedback, 'Unable to reach the server. Please try again.', false)
  }
}

function initLoginForms() {
  document.querySelectorAll(LOGIN_FORM_SELECTOR).forEach((form) => {
    form.addEventListener('submit', handleLoginSubmit)
  })
  const roleSelector = document.querySelector('[data-login-role]')
  if (roleSelector) {
    const hashRole = window.location.hash ? window.location.hash.replace('#', '') : ''
    if (hashRole && ROLE_CONFIG[hashRole]) {
      roleSelector.value = hashRole
    }
    applyRoleConfig(roleSelector.value)
    roleSelector.addEventListener('change', (event) => {
      const selectedRole = event.target.value
      applyRoleConfig(selectedRole)
      window.location.hash = selectedRole
    })
  } else {
    applyRoleConfig('customer')
  }
}

async function redirectIfAlreadyAuthenticated() {
  try {
    const response = await fetch(SESSION_STATUS_ENDPOINT, { credentials: 'include' })
    if (!response.ok) {
      return false
    }
    const data = await response.json().catch(() => ({}))
    const role = data.profile?.role
    if (!role) {
      return false
    }
    const config = ROLE_CONFIG[role]
    if (!config?.redirect) {
      return false
    }
    window.location.replace(config.redirect)
    return true
  } catch (error) {
    return false
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initLoginForms()
  redirectIfAlreadyAuthenticated()
})
