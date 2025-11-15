const knex = require('./knexfile')

// INSERT
exports.insertOrder = (ord) => knex('Orders').insert(ord)

// VIEW
exports.viewAllOrders = () => knex('Orders').select('*')
exports.getInventoryByBatch = (id) => knex('Orders').where('batch_id',id)
exports.getInventoryByClient = (id) => knex('Orders').where('client_id',id)
exports.getInventoryByLocation = (id) => knex('Orders').where('location_id',id)
exports.getInventoryByOrderDate = (date) => knex('Orders').where('order_date',date)
exports.getInventoryByOrder = (id) => knex('Orders').where('order_id',id)
exports.getInventoryByShippingStatus = (ship) => knex('Orders').where('is_shipped',ship)
exports.getInventoryByQty = (qty) => knex('Orders').where('quantity',qty)

// DELETE
exports.deleteOrder = (id) => knex('Orders').where('order_id',id).delete()