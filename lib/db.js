// lib/db.js

const mysql = require('mysql2/promise');

let pool;

const getDbConnection = async () => {
    if (!pool) {
        pool = mysql.createPool({
            host: 'localhost',
            user: 'root', // Replace with your MySQL username
            password: 'Koireng@1',
            database: 'mydatabase',
        });
    }
    return pool;
};

module.exports = { getDbConnection };

