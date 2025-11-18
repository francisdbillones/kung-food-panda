const LOGIN_FORM_SELECTOR = '[data-login-form]'
const FEEDBACK_CLASS = 'form-feedback'

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
}

document.addEventListener('DOMContentLoaded', initLoginForms)
