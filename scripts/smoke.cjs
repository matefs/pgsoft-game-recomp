const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://localhost:3006';
async function post(route, data) {
  const response = await fetch(base + route, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data), signal: AbortSignal.timeout(8000)});
  assert.equal(response.status, 200, route);
  return response.json();
}
async function main() {
  assert.equal((await (await fetch(base + '/status')).json()).status, 'operational');
  const page = await fetch(base + '/126/index.html');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Fortune Tiger/);
  const cors = await fetch(base + '/status', {headers: {Origin: base}});
  assert.equal(cors.headers.get('access-control-allow-origin'), base);
  const invalid = await post('/web-api/auth/session/v2/verifySession', {tk: 'invalid', gi: '126'});
  assert.equal(invalid.err.cd, '1302');
  const session = await post('/web-api/auth/session/v2/verifySession', {tk: 'local-demo-token', gi: '126'});
  assert.equal(session.dt.tk, 'local-demo-atk');
  const catalogResponse = await fetch(base + '/api/v1/games', {headers: {Authorization: 'Bearer local-demo-token'}});
  assert.equal(catalogResponse.status, 200);
  assert.equal(catalogResponse.headers.get('cache-control'), 'no-store');
  const catalog = await catalogResponse.json();
  assert.equal(catalog.total, catalog.games.length);
  assert.equal((await fetch(base + '/api/v1/games')).status, 401);
  assert.equal((await fetch(base + '/api/v1/games', {headers: {Authorization: 'Bearer invalid'}})).status, 401);
  assert.deepEqual(await (await fetch(base + '/api/v1/games/demo')).json(), catalog);
  for (const game of catalog.games) {
    if (!game.available) {
      assert.equal(game.launch_url, null, game.game_code);
      assert.ok(game.reason);
      continue;
    }
    const url = new URL(game.launch_url);
    assert.equal(url.origin, base);
    assert.equal(url.searchParams.get('t'), 'local-demo-token');
    assert.equal(url.searchParams.get('localDemo'), '1');
    assert.equal((await fetch(url, {method: 'HEAD'})).status, 200, game.game_code);
    const gameSession = await post('/web-api/auth/session/v2/verifySession', {tk: url.searchParams.get('t'), gi: String(game.game_id)});
    assert.equal(gameSession.dt.geu, `game-api/${game.game_code}/`);
  }
  console.log(`OK Catálogo: ${catalog.games.filter(game => game.available).length} links e sessões válidos`);
  const launch = await post('/api/v1/game_launch', {agentToken: 'local-agent-token', secretKey: 'local-secret-key', user_code: 'smoke-local', user_balance: 1000, game_type: 'slot', provider_code: 'PGSOFT', game_code: 'fortune-tiger'});
  assert.equal(launch.status, 1);
  assert.equal(new URL(launch.launch_url).origin, base);
  assert.equal(new URL(launch.launch_url).searchParams.get("l"), "pt");
  assert.equal(new URL(launch.launch_url).searchParams.has("or"), false);
  const firstSession = await post('/web-api/auth/session/v2/verifySession', {tk: new URL(launch.launch_url).searchParams.get('t'), gi: '126'});
  const firstInfo = await post('/game-api/fortune-tiger/v2/GameInfo/Get', {atk: firstSession.dt.tk});
  assert.equal(firstInfo.err, null);
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes.ts'), 'utf8');
  const infos = [...new Set([...routes.matchAll(/^routes\.post\("([^"]+\/GameInfo\/Get)"/gm)].map(m => m[1]))];
  for (const route of infos) {
    const info = await post(route, {atk: 'local-demo-atk'});
    assert.equal(info.err, null, route);
    assert.ok(info.dt, route);
    if (route.includes('/majestic-ts/')) {
      assert.equal(info.dt.ls.si.rl.length, 25);
      assert.ok(Array.isArray(info.dt.ls.si.gs));
    }
    if (route.includes('/piggy-gold/')) {
      assert.equal(info.dt.ls.si.rl.length, 3);
      assert.equal(info.dt.ls.si.frl.length, 9);
    }
    console.log('OK GameInfo', route);
  }
  for (const game of ['fortune-tiger', 'fortune-ox', 'fortune-rabbit', 'treasures-aztec']) {
    const spin = await post(`/game-api/${game}/v2/Spin`, {atk: 'local-demo-atk', cs: 0.08, ml: 1});
    assert.equal(spin.err, null, game);
    assert.ok(spin.dt?.si, game);
    console.log('OK Spin', game);
  }
  console.log(`OK: status, arquivos estáticos, CORS, sessões, lançamento, primeiro acesso, ${infos.length} GameInfo e 4 spins. Saldo fictício alterado pelos spins.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
