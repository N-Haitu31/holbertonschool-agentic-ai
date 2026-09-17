const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, QUEUE_KEY } = require('../server.js');

function createFakeQueueClient() {
  return {
    calls: [],
    async lPush(key, value) {
      this.calls.push({ key, value });
      return 1;
    },
  };
}

let server;
let baseUrl;
let queueClient;

test.before(async () => {
  queueClient = createFakeQueueClient();
  const app = createApp(queueClient);
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

test.beforeEach(() => {
  queueClient.calls = [];
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

test('a valid notification is pushed onto the queue before responding 200', async () => {
  const body = { transactionId: 'tx_789', status: 'success' };

  const res = await fetch(`${baseUrl}/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  assert.equal(res.status, 200);
  assert.equal(queueClient.calls.length, 1);
  assert.equal(queueClient.calls[0].key, QUEUE_KEY);
  assert.deepEqual(JSON.parse(queueClient.calls[0].value), body);
});

test('an invalid JSON body is never pushed onto the queue', async () => {
  await fetch(`${baseUrl}/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ still not valid json',
  });

  assert.equal(queueClient.calls.length, 0);
});
