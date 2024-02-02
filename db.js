
const mysql = require('mysql');
require('dotenv').config();

const db = mysql.createPool({
    connectionLimit: 30,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    multipleStatements: true
  });
  
  
  module.exports = db;  

