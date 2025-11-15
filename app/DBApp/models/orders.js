const knex = require('./knexfile')

// INSERT
exports.insertOrder = (ord) => knex('Orders').insert(ord)

// VIEW
exports.viewAllOrders = () => knex('Orders').select('*')
exports.getOrderByBatch = (id) => knex('Orders').where('batch_id',id)
exports.getOrderByClient = (id) => knex('Orders').where('client_id',id)
exports.getOrderByLocation = (id) => knex('Orders').where('location_id',id)
exports.getOrderByOrderDate = (date) => knex('Orders').where('order_date',date)
exports.getOrderByID = (id) => knex('Orders').where('order_id',id)
exports.getOrderByShippingStatus = (ship) => knex('Orders').where('is_shipped',ship)
exports.getOrderByQty = (qty) => knex('Orders').where('quantity',qty)

// DELETE
exports.deleteOrder = (id) => knex('Orders').where('order_id',id).delete()