const knex = require('./knexfile')

// INSERT
exports.insertSubscription = (sub) => knex('Subscription').insert(sub)

// VIEW
exports.viewAllSubscription = () => knex('Subscription').select('*')
exports.getSubscriptionByProgram = (id) => knex('Subscription').where('program_id',id)
exports.getSubscriptionByProduct = (id) => knex('Subscription').where('product_id',id)
exports.getSubscriptionByClient = (id) => knex('Subscription').where('client_id',id)
exports.getSubscriptionByInterval = (i) => knex('Subscription').where('order_interval_days',i)
exports.getSubscriptionByQty = (qty) => knex('Subscription').where('quantity',qty)
exports.getSubscriptionByLocation = (loc) => knex('Subscription').where('location_id',loc)

// UPDATE
exports.updateSubscription = (id, sub) => knex('Subscription').where('program_id',id).update(sub)

// DELETE
exports.deleteSubscription = (id) => knex('Subscription').where('program_id',id).delete()