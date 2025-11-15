const knex = require('./knexfile')

// INSERT
exports.insertRProduct = (sub) => knex('RawProduct').insert(sub)

// VIEW
exports.viewAllRProduct = () => knex('RawProduct').select('*')
exports.getRProductByID = (id) => knex('RawProduct').where('product_id',id)
exports.getRProductByName = (n) => knex('RawProduct').where('product_name',n)
exports.getRProductByType = (t) => knex('RawProduct').where('product_type',t)
exports.getRProductByGrade = (i) => knex('RawProduct').where('grade',i)
exports.getRProductBySeason = (s) => knex('RawProduct').where('start_date','>=',s).where('end_date','>=',s)

// UPDATE
exports.updateRProduct = (id, rp) => knex('RawProduct').where('product_id',id).update(rp)

// DELETE
exports.deleteRProduct = (id) => knex('RawProduct').where('product_id',id).delete()