const knex = require('knex')({
    client: 'mysql',
    connection: {
        host: '127.0.0.1', // localhost
        port: 3306,
        user: 'app_user',
        password: 'SUPER_SECRET_PANDA_PASS',
        database: 'kungfoodpanda_db'
    },
    pool: {
        min: 2,
        max: 10
    }
})

module.exports = knex