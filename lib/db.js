// lib/db.js

const mysql = require('mysql2/promise');

let pool;

const getDbConnection = async () => {
    if (!pool) {
        pool = mysql.createPool({
            host: 'localhost',
            user: 'yourUsername', // Replace with your MySQL username
            password: 'Koireng',
            database: 'mydatabase',
        });
    }
    return pool;
};

module.exports = { getDbConnection };

