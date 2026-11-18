// Simulador da carteira externa, somente para desenvolvimento local.
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
if (process.env.AMBIENTE !== 'DEV') throw new Error('Callback simulado exige AMBIENTE=DEV');
const pool = mysql.createPool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, decimalNumbers: true,
});
const app = express();
app.use(express.json());
app.post('/gold_api/user_balance', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT saldo FROM users WHERE username = ? AND agentid = 1', [req.body.user_code]);
    if (!users.length) return res.json({status: 0, msg: 'INVALID_USER'});
    res.json({status: 1, msg: users[0].saldo > 0 ? 'SUCCESS' : 'INSUFFICIENT_USER_FUNDS', user_balance: users[0].saldo});
  } catch (error) { console.error(error); res.status(500).json({status: 0, msg: 'LOCAL_DATABASE_ERROR'}); }
});
app.post('/gold_api/game_callback', (req, res) => {
  // A própria API atualiza o saldo do banco. Não debitar uma segunda vez.
  res.json({status: 1, msg: 'SUCCESS'});
});
const server = app.listen(3007, '127.0.0.1', () => console.log('Callback local: http://127.0.0.1:3007'));
server.on('error', error => { console.error(error); process.exitCode = 1; });
