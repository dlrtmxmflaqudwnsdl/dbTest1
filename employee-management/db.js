require('dotenv').config(); // dotenv 패키지 불러오기

const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST, // 환경 변수 사용
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

module.exports = pool;
