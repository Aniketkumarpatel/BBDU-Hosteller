import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { default: app } = await import('../src/app.js');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => new Promise((resolve) => server.close(resolve)));

test('GET /api/health returns success payload with database status', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.message, 'BBDU Hosteller API is running');
  assert.equal(typeof body.database.status, 'string');
  assert.equal(typeof body.database.connected, 'boolean');
  // The connection string must never be exposed.
  assert.equal(JSON.stringify(body).includes('mongodb'), false);
});


test('unknown route returns JSON 404 via central error handler', async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Route not found/);
});
