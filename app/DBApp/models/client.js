const knex = require('./knexfile')

// INSERT
exports.insertClient = (sub) => knex('Client').insert(sub)

// VIEW
exports.viewAllClients = () => knex('Client').select('*')
exports.getClientByID = (id) => knex('Client').where('client_id',id)
exports.getClientByCompany = (n) => knex('Client').where('company_name',n)
exports.getClientByFirstName = (n) => knex('Client').where('first_name',n)
exports.getClientBySurname = (n) => knex('Client').where('last_name',n)
exports.getClientByHonorific = (h) => knex('Client').where('honorific',h)
exports.getClientByEmail = (i) => knex('Client').where('email',i)
exports.getClientByLocation = (loc) => knex('Client').where('location_id',loc)
exports.getClientByLoyaltyPts = (n) => knex('Client').where('loyalty_points',n)

// UPDATE
exports.updateClient = (id, cl) => knex('Client').where('client_id',id).update(cl)

// DELETE
exports.deleteClient = (id) => knex('Client').where('client_id',id).del()