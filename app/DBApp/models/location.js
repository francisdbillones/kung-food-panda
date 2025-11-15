const knex = require('./knexfile')

// INSERT
exports.insertLocation = (loc) => knex('Orders').insert(loc)


// VIEW
exports.viewAllLocations = () => knex('Location').select('*')
exports.getLocationsByContinent = (c) => knex('Location').where('continent',c)
exports.getLocationsByCountry = (c) => knex('Location').where('country',c)
exports.getLocationsByState = (c) => knex('Location').where('state',c)
exports.getLocationsByCity = (c) => knex('Location').where('city',c)
exports.getLocationsByStreet = (c) => knex('Location').where('street',c)

// DELETE
exports.deleteLocation = (id) => knex('Location').where('location_id',id).delete()
