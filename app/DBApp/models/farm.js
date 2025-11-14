const knex = require('./knexfile')

// INSERT
exports.insertFarm = (location_id) => knex('Farm').insert(location_id)

// VIEW
exports.viewAllFarms = () => knex('Farm').select('*')
exports.getFarmsByID = (id) => knex('Farm').where('farm_id',id)
exports.getFarmsByLocation = (id) => knex('Farm').where('location_id',id)

// DELETE
exports.deleteFarm = (id) => knex('Farm').where('farm_id',id).del()
exports.deleteFarmByLocation = (id) => knex('Farm').where('location_id',id).del()