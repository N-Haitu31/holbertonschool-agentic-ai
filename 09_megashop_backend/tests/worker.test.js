const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processTransaction,
  createBudgetTracker,
  resolveOperator,
  REFUND_STATUS,
} = require('../worker.js');

const HITL_SCORE = 'validation_humaine_remboursement';
const BUDGET_SCORE = 'finops_budget';

function createFakeLangfuse() {
  return {
    calls: [],
    score(payload) {
      this.calls.push(payload);
    },
    async flushAsync() {},
    named(name) {
      return this.calls.filter((call) => call.name === name);
    },
  };
}

function fakeAnalyze(totalTokens = 600, onTrace = () => {}) {
  return async (_tx, traceId) => {
    onTrace(traceId);
    return { verdict: 'verdict', totalTokens };
  };
}

async function captureConsoleError(fn) {
  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return lines;
}

test('a non-refund transaction is analyzed but never triggers human confirmation', async () => {
  let confirmCalled = false;
  const langfuse = createFakeLangfuse();

  const result = await processTransaction(
    { transactionId: 'tx_1', status: 'success' },
    {
      analyze: fakeAnalyze(),
      confirmHuman: async () => { confirmCalled = true; return true; },
      langfuse,
      budget: createBudgetTracker(),
    },
  );

  assert.equal(confirmCalled, false);
  assert.equal(langfuse.named(HITL_SCORE).length, 0);
  assert.deepEqual(result, { verdict: 'verdict', refundApplied: false, humanAuthorized: null });
});

test('a refund transaction authorized by the human is applied and scored as success', async () => {
  let capturedTraceId;
  const langfuse = createFakeLangfuse();

  const result = await processTransaction(
    { transactionId: 'tx_2', status: REFUND_STATUS },
    {
      analyze: fakeAnalyze(600, (traceId) => { capturedTraceId = traceId; }),
      confirmHuman: async () => true,
      langfuse,
      budget: createBudgetTracker(),
    },
  );

  const scores = langfuse.named(HITL_SCORE);
  assert.equal(result.refundApplied, true);
  assert.equal(result.humanAuthorized, true);
  assert.equal(scores.length, 1);
  assert.equal(scores[0].value, 1);
  assert.equal(scores[0].traceId, capturedTraceId);
});

test('a refund transaction refused by the human is cancelled and scored as failure', async () => {
  let capturedTraceId;
  const langfuse = createFakeLangfuse();

  const result = await processTransaction(
    { transactionId: 'tx_3', status: REFUND_STATUS },
    {
      analyze: fakeAnalyze(600, (traceId) => { capturedTraceId = traceId; }),
      confirmHuman: async () => false,
      langfuse,
      budget: createBudgetTracker(),
    },
  );

  const scores = langfuse.named(HITL_SCORE);
  assert.equal(result.refundApplied, false);
  assert.equal(result.humanAuthorized, false);
  assert.equal(scores.length, 1);
  assert.equal(scores[0].value, 0);
  assert.equal(scores[0].traceId, capturedTraceId);
});

test('an analysis within budget is scored 1 on the trace of the analysis, with no alert', async () => {
  let capturedTraceId;
  const langfuse = createFakeLangfuse();

  const errors = await captureConsoleError(() => processTransaction(
    { transactionId: 'tx_4', status: 'success' },
    {
      analyze: fakeAnalyze(600, (traceId) => { capturedTraceId = traceId; }),
      langfuse,
      budget: createBudgetTracker({ maxTokensPerCall: 1500, tokenBudget: 20000 }),
    },
  ));

  const scores = langfuse.named(BUDGET_SCORE);
  assert.equal(scores.length, 1);
  assert.equal(scores[0].value, 1);
  assert.equal(scores[0].traceId, capturedTraceId);
  assert.equal(errors.length, 0);
});

test('an analysis above the per-call token limit raises an alert and is scored 0', async () => {
  const langfuse = createFakeLangfuse();

  const errors = await captureConsoleError(() => processTransaction(
    { transactionId: 'tx_5', status: 'success' },
    {
      analyze: fakeAnalyze(2000),
      langfuse,
      budget: createBudgetTracker({ maxTokensPerCall: 1500, tokenBudget: 20000 }),
    },
  ));

  assert.equal(langfuse.named(BUDGET_SCORE)[0].value, 0);
  assert.ok(errors.some((line) => line.includes('ALERTE FINOPS')), 'expected a FinOps alert');
});

test('the cumulative token budget is enforced across successive analyses', async () => {
  const langfuse = createFakeLangfuse();
  const budget = createBudgetTracker({ maxTokensPerCall: 1000, tokenBudget: 1000 });

  await captureConsoleError(async () => {
    for (const id of ['tx_6a', 'tx_6b']) {
      await processTransaction(
        { transactionId: id, status: 'success' },
        { analyze: fakeAnalyze(600), langfuse, budget },
      );
    }
  });

  const values = langfuse.named(BUDGET_SCORE).map((call) => call.value);
  assert.deepEqual(values, [1, 0]);
});

test('an empty or invalid budget configuration falls back to safe defaults instead of a zero budget', async () => {
  const langfuse = createFakeLangfuse();

  await processTransaction(
    { transactionId: 'tx_7', status: 'success' },
    {
      analyze: fakeAnalyze(600),
      langfuse,
      budget: createBudgetTracker({ maxTokensPerCall: '', tokenBudget: 'abc' }),
    },
  );

  assert.equal(langfuse.named(BUDGET_SCORE)[0].value, 1);
});

test('an authorized refund records who validated it in the score comment', async () => {
  const langfuse = createFakeLangfuse();

  await processTransaction(
    { transactionId: 'tx_8', status: REFUND_STATUS },
    {
      analyze: fakeAnalyze(),
      confirmHuman: async () => true,
      langfuse,
      budget: createBudgetTracker(),
      operator: 'alice',
    },
  );

  assert.match(langfuse.named(HITL_SCORE)[0].comment, /alice/);
});

test('a refused refund also records who refused it in the score comment', async () => {
  const langfuse = createFakeLangfuse();

  await processTransaction(
    { transactionId: 'tx_9', status: REFUND_STATUS },
    {
      analyze: fakeAnalyze(),
      confirmHuman: async () => false,
      langfuse,
      budget: createBudgetTracker(),
      operator: 'bob',
    },
  );

  assert.match(langfuse.named(HITL_SCORE)[0].comment, /bob/);
});

test('the operator comes from OPERATOR_NAME, and is never guessed when it is missing', () => {
  assert.equal(resolveOperator({ OPERATOR_NAME: '  carol ' }), 'carol');
  assert.equal(resolveOperator({}), 'non-identifié');
  assert.equal(resolveOperator({ OPERATOR_NAME: '' }), 'non-identifié');
});
