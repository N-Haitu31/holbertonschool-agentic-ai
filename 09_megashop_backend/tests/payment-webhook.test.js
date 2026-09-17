const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server.js');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('POST /webhooks/payment with valid JSON returns 200 immediately', async () => {
  const res = await fetch(`${baseUrl}/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: 'tx_123', status: 'success' }),
  });
  assert.equal(res.status, 200);
});

test('POST /webhooks/payment with invalid JSON returns 400, service stays up', async () => {
  const res = await fetch(`${baseUrl}/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ this is not valid json',
  });
  assert.equal(res.status, 400);

  const followUp = await fetch(`${baseUrl}/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  });
  assert.equal(followUp.status, 200);
});

test('GET /webhooks/payment on the wrong method returns 404', async () => {
  const res = await fetch(`${baseUrl}/webhooks/payment`, { method: 'GET' });
  assert.equal(res.status, 404);
});

test('a received notification is traced to the console', async () => {
  const originalLog = console.log;
  const calls = [];
  console.log = (...args) => calls.push(args.join(' '));

  try {
    await fetch(`${baseUrl}/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: 'tx_456' }),
    });
  } finally {
    console.log = originalLog;
  }

  assert.ok(calls.some((line) => line.includes('tx_456')), 'expected the notification to be logged');
});
