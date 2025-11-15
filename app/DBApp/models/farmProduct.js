const knex = require('./knexfile')

// INSERT
exports.insertFProduct = (product) => knex('Inventory').insert(product)

// VIEW
exports.viewAllFProducts = () => knex('FarmProduct').select('*')
exports.getFProductByProductID = (id) => knex('FarmProduct').where('product_id',id)
exports.getFProductByFarmID = (id) => knex('FarmProduct').where('farm_id',id)
exports.getFProductByPKs = (id1, id2) => knex('FarmProduct').where('farm_id',id1).where('product_id', id2)

// UPDATE
exports.updateFProduct = (farm, product, value) => knex('FarmProduct').where('farm_id', farm).where('product_id',product).update(value)

//DELETE
exports.deleteFProduct = (id1, id2) => knex('FarmProduct').where('farm_id',id1).where('product_id', id2).delete()