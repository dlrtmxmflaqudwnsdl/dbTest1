const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost', // MySQL 서버 주소
    user: 'root', // MySQL 사용자 이름
    password: 'nbj5493642`', // MySQL 비밀번호
    database: 'new_schema', // 데이터베이스 이름
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();
