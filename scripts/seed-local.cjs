// Reconstrução para testes: colunas inferidas do SQL e estados obtidos dos fixtures existentes.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function loadFixture(file, fixture) {
  const modulePath = path.resolve(__dirname, '../dist/controllers', path.dirname(file), fixture);
  const factory = require(modulePath).default;
  return factory[Object.keys(factory)[0]](1000, 0.1, 1);
}

async function repairInitialState(file, source, state) {
  const fixture = source.match(/import\s+\w+\s+from\s+["']([^"']*\/linhaperda[^"']*)["']/)?.[1];
  if (!fixture) return;

  const result = await loadFixture(file, fixture);
  const round = result?.dt?.si ?? result;
  if (!round) return;

  const initial = state.dt.si;
  const reels = round.rl ?? round.orl;
  const wrongReels = Array.isArray(reels) && reels.length !== initial.rl?.length;
  const missingStructures = Object.entries(round).some(([key, value]) =>
    value !== null && typeof value === 'object' && initial[key] === undefined
  );
  if (!wrongReels && !missingStructures) return;

  const { id, tipo, multiplicador, ...spin } = round;
  state.dt.si = {
    ...initial,
    ...spin,
    rl: reels ?? initial.rl,
    st: 1, nst: 1, ml: initial.ml, cs: initial.cs,
    bl: 1000, blab: 1000, blb: 1000,
    tb: 0, tbb: 0, tw: 0, np: 0, aw: 0,
  };
}

async function seed() {
  if (process.env.AMBIENTE !== 'DEV' || !['127.0.0.1', 'localhost'].includes(process.env.DB_HOST) || process.env.DB_NAME !== 'pgsoft_local') {
    throw new Error('Seed permitido somente no banco local pgsoft_local com AMBIENTE=DEV');
  }
  const db = await mysql.createConnection({host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME});
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../docker/mysql/init/001-schema.sql'), 'utf8');
    for (const statement of schema.split(';').filter(s => s.trim())) await db.query(statement);
    await db.execute(`INSERT INTO agents (id, agentcode, agentToken, secretKey, callbackurl)
      VALUES (1, 'local-demo', 'local-agent-token', 'local-secret-key', 'http://127.0.0.1:3007/')
      ON DUPLICATE KEY UPDATE id = id`);
    await db.execute(`INSERT INTO users (id, username, agentid, token, atk, saldo)
      VALUES (1, 'demo', 1, 'local-demo-token', 'local-demo-atk', 1000)
      ON DUPLICATE KEY UPDATE id = id`);
    const controllers = fs.readdirSync(path.join(__dirname, '../src/controllers'), {recursive: true}).filter(p => p.endsWith('.ts') && !p.includes('CONTROLLER '));
    let count = 0;
    for (const file of controllers) {
      const source = fs.readFileSync(path.join(__dirname, '../src/controllers', file), 'utf8');
      const game = source.match(/const gamename(?::\s*string)?\s*=\s*["']([^"']+)["']/)?.[1];
      const fixture = source.match(/import\s+\w+\s+from\s+["']([^"']*\/notcash[^"']*)["']/)?.[1];
      if (!game || !fixture) continue;
      const state = await loadFixture(file, fixture);
      if (!state?.dt?.si) throw new Error(`Fixture inválido para ${game}`);
      state.err = null;
      const oldSeed = JSON.stringify(state);
      await repairInitialState(file, source, state);
      const newSeed = JSON.stringify(state);
      await db.beginTransaction();
      try {
        await db.execute('INSERT INTO spins_inicial (game_code, json) VALUES (?, ?) ON DUPLICATE KEY UPDATE game_code = game_code', [game, newSeed]);
        if (oldSeed !== newSeed) {
          const [update] = await db.execute('UPDATE spins_inicial SET json = ? WHERE game_code = ? AND BINARY json = ?', [newSeed, game, oldSeed]);
          if (update.affectedRows) {
            await db.execute('UPDATE spins SET json = ? WHERE game_code = ? AND BINARY json = ?', [newSeed, game, oldSeed]);
            console.log(`Estado inicial corrigido: ${game}`);
          }
        }
        await db.commit();
      } catch (error) {
        await db.rollback();
        throw error;
      }
      count++;
    }
    console.log(`Seed local pronto: agente, usuário demo e ${count} estados iniciais. Saldos existentes preservados.`);
  } finally { await db.end(); }
}
seed().catch(error => { console.error(error); process.exitCode = 1; });
