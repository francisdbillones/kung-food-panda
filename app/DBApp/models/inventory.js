const knex = require('./knexfile')

// INSERT
exports.insertBatch = (batch) => knex('Inventory').insert(batch)

// VIEW
exports.viewAllInventory = () => knex('Inventory').select('*')
exports.getInventoryByBatch = (batchId) => knex('Inventory').where('batch_id',batchId)
exports.getInventoryByProduct = (productId) => knex('Inventory').where('product_id',productId)
exports.getInventoryByFarm = (farmId) => knex('Inventory').where('farm_id',farmId)
exports.getInventoryByPrice = (lowPrice, highPrice) => knex('Inventory').whereBetween('price', [lowPrice, highPrice])
// exports.getInventoryByPrice = (price) => knex('Inventory').where('price',price)
exports.getInventoryByWeight = (weight) => knex('Inventory').where('weight',weight)
exports.getInventoryByExpDate = (expDate) => knex('Inventory').where('exp_date',expDate)
exports.getInventoryByQty = (qty) => knex('Inventory').where('quantity',qty)

// UPDATE
exports.updateBatch = (id, batch) => knex('Inventory').where('batch_id',id).update(batch)

// DELETE
exports.deleteBatch = (id) => knex('Inventory').where('batch_id',id).del()
exports.deleteExpired = (expDate) => knex('Inventory').where('exp_date',expDate).delete()