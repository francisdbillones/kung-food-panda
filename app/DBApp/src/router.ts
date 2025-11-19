import { IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'
import { redirectLoggedInUsers } from './services/sessionService'
import { handleCustomerLogin, handleFarmerLogin, handleAdminLogin, handleSessionRead, handleLogout } from './controllers/authController'
import {
  handleAccountRead,
  handleAccountUpdate,
  handleCancelSubscription,
  handleCreateLocation,
  handleCreateOrder,
  handleCreateSubscription,
  handleCustomerDashboard,
  handleCustomerSubscriptions,
  handleOrderBatch,
  handleOrderOptions,
  handleProductOffers
} from './controllers/customerController'
import {
  handleAdminEntityCreate,
  handleAdminEntityDelete,
  handleAdminEntityUpdate,
  handleAdminOverview
} from './controllers/adminController'
import {
  handleFarmerDashboard,
  handleFarmerFulfillment,
  handleFarmerInventoryCreate,
  handleFarmerInventoryDelete,
  handleFarmerInventoryUpdate,
  handleFarmerOfferingsCreate,
  handleFarmerOfferingsDelete,
  handleFarmerOfferingsUpdate,
  handleFarmerSubscriptionUpdate
} from './controllers/farmerController'
import { serveStatic } from './staticServer'
import { sendJson } from './lib/http'

export async function routeRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  const { pathname } = url
  const farmerInventoryMatch = pathname.match(/^\/api\/farmer\/inventory\/(\d+)$/)
  const farmerSubscriptionMatch = pathname.match(/^\/api\/farmer\/subscriptions\/(\d+)$/)
  const farmerOfferingMatch = pathname.match(/^\/api\/farmer\/offerings\/(\d+)$/)
  const customerSubscriptionMatch = pathname.match(/^\/api\/customer\/subscriptions\/(\d+)$/)
  const adminEntityMatch = pathname.match(/^\/api\/admin\/entities\/([^/]+)\/([^/]+)$/)

  try {
    if (request.method === 'GET' && await redirectLoggedInUsers(request, response, pathname)) {
      return
    }
    if (request.method === 'POST' && pathname === '/api/login/customer') {
      await handleCustomerLogin(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/login/farmer') {
      await handleFarmerLogin(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/login/admin') {
      await handleAdminLogin(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/session') {
      await handleSessionRead(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/logout') {
      await handleLogout(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/dashboard') {
      await handleCustomerDashboard(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/subscriptions') {
      await handleCustomerSubscriptions(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/customer/subscriptions') {
      await handleCreateSubscription(request, response)
      return
    }
    if (customerSubscriptionMatch && request.method === 'DELETE') {
      await handleCancelSubscription(request, response, Number(customerSubscriptionMatch[1]))
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/subscriptions/offers') {
      await handleProductOffers(request, response, url.searchParams)
      return
    }
    if (request.method === 'POST' && pathname === '/api/customer/locations') {
      await handleCreateLocation(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/account') {
      await handleAccountRead(request, response)
      return
    }
    if (request.method === 'PUT' && pathname === '/api/customer/account') {
      await handleAccountUpdate(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/orders/options') {
      await handleOrderOptions(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/customer/orders/batch') {
      await handleOrderBatch(request, response, url.searchParams)
      return
    }
    if (request.method === 'POST' && pathname === '/api/customer/orders') {
      await handleCreateOrder(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/admin/overview') {
      await handleAdminOverview(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/admin/entities') {
      await handleAdminEntityCreate(request, response)
      return
    }
    if (adminEntityMatch && request.method === 'PUT') {
      await handleAdminEntityUpdate(request, response, adminEntityMatch[1], adminEntityMatch[2])
      return
    }
    if (adminEntityMatch && request.method === 'DELETE') {
      await handleAdminEntityDelete(request, response, adminEntityMatch[1], adminEntityMatch[2])
      return
    }
    if (request.method === 'GET' && pathname === '/api/farmer/dashboard') {
      await handleFarmerDashboard(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/farmer/inventory') {
      await handleFarmerInventoryCreate(request, response)
      return
    }
    if (farmerInventoryMatch && request.method === 'PUT') {
      await handleFarmerInventoryUpdate(request, response, Number(farmerInventoryMatch[1]))
      return
    }
    if (farmerInventoryMatch && request.method === 'DELETE') {
      await handleFarmerInventoryDelete(request, response, Number(farmerInventoryMatch[1]))
      return
    }
    if (request.method === 'POST' && pathname === '/api/farmer/fulfillments') {
      await handleFarmerFulfillment(request, response)
      return
    }
    if (farmerSubscriptionMatch && request.method === 'PUT') {
      await handleFarmerSubscriptionUpdate(request, response, Number(farmerSubscriptionMatch[1]))
      return
    }
    if (request.method === 'POST' && pathname === '/api/farmer/offerings') {
      await handleFarmerOfferingsCreate(request, response)
      return
    }
    if (farmerOfferingMatch && request.method === 'PUT') {
      await handleFarmerOfferingsUpdate(request, response, Number(farmerOfferingMatch[1]))
      return
    }
    if (farmerOfferingMatch && request.method === 'DELETE') {
      await handleFarmerOfferingsDelete(request, response, Number(farmerOfferingMatch[1]))
      return
    }

    await serveStatic(pathname, response)
  } catch (error) {
    console.error('Request error', error)
    if (!response.headersSent) {
      sendJson(response, 500, { error: 'Unexpected server error.' })
    } else {
      response.end()
    }
  }
}
