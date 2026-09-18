const test = require('node:test');
const assert = require('node:assert/strict');
const { processTransaction, REFUND_STATUS } = require('../worker.js');

function createFakeLangfuse() {
  return {
    calls: [],
    score(payload) {
      this.calls.push(payload);
    },
    async flushAsync() {},
  };
}

test('a non-refund transaction is analyzed but never triggers human confirmation', async () => {
  let confirmCalled = false;
  const langfuse = createFakeLangfuse();

  const result = await processTransaction(
    { transactionId: 'tx_1', status: 'success' },
    {
      analyze: async () => 'verdict normale',
      confirmHuman: async () => { confirmCalled = true; return true; },
      langfuse,
    },
  );

  assert.equal(confirmCalled, false);
  assert.equal(langfuse.calls.length, 0);
  assert.deepEqual(result, { verdict: 'verdict normale', refundApplied: false, humanAuthorized: null });
});

test('a refund transaction authorized by the human is applied and scored as success', async () => {
  let capturedTraceId;
  const langfuse = createFakeLangfuse();

  const result = await processTransaction(
    { transactionId: 'tx_2', status: REFUND_STATUS },
    {
      analyze: async (_tx, traceId) => { capturedTraceId = traceId; return 'verdict suspecte'; },
      confirmHuman: async () => true,
      langfuse,
    },
  );

  assert.equal(result.refundApplied, true);
  assert.equal(result.humanAuthorized, true);
  assert.equal(langfuse.calls.length, 1);
  assert.equal(langfuse.calls[0].value, 1);
  assert.equal(langfuse.calls[0].traceId, capturedTraceId);
});

test('a refund transaction refused by the human is cancelled and scored as failure', async () => {
  let capturedTraceId;
  const langfuse = createFakeLangfuse();

  const result = await processTransaction(
    { transactionId: 'tx_3', status: REFUND_STATUS },
    {
      analyze: async (_tx, traceId) => { capturedTraceId = traceId; return 'verdict normale'; },
      confirmHuman: async () => false,
      langfuse,
    },
  );

  assert.equal(result.refundApplied, false);
  assert.equal(result.humanAuthorized, false);
  assert.equal(langfuse.calls.length, 1);
  assert.equal(langfuse.calls[0].value, 0);
  assert.equal(langfuse.calls[0].traceId, capturedTraceId);
});
