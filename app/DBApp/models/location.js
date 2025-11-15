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
exports.deleteLocationsByContinent = (c) => knex('Location').where('continent',c).delete()
exports.deleteLocationsByCountry = (c, co) => knex('Location').where('country',c).where('continent',co).delete()
exports.deleteLocationsByState = (c, s) => knex('Location').where('country',c).where('state',s).delete()
exports.deleteLocationsByCity = (c, s, co) => knex('Location').where('city',c).where('country',co).where('state',s).delete()
exports.deleteLocationsByStreet = (c,s,ci,st) => knex('Location').where('street',st).where('city',ci).where('country',c).where('state',s).delete()
