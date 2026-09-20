require('dotenv').config();

const OpenAI = require('openai');
const { observeOpenAI, Langfuse } = require('langfuse');
const { randomUUID } = require('node:crypto');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { QUEUE_KEY } = require('./server.js');
const { connectQueueWithRetry } = require('./queue.js');

const REFUND_STATUS = 'refund';

// Défauts posés à partir des mesures de FINOPS_REVIEW.md (analyses réelles : 620 à 946 tokens).
const DEFAULT_MAX_TOKENS_PER_CALL = 1500;
const DEFAULT_TOKEN_BUDGET = 20000;

function readPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createBudgetTracker({ maxTokensPerCall, tokenBudget } = {}) {
  const perCallLimit = readPositiveNumber(maxTokensPerCall, DEFAULT_MAX_TOKENS_PER_CALL);
  const totalBudget = readPositiveNumber(tokenBudget, DEFAULT_TOKEN_BUDGET);
  let used = 0;

  return {
    record(totalTokens) {
      used += totalTokens;
      if (totalTokens > perCallLimit) {
        return { withinBudget: false, reason: `${totalTokens} tokens sur un appel (limite ${perCallLimit})` };
      }
      if (used > totalBudget) {
        return { withinBudget: false, reason: `${used} tokens cumulés (budget ${totalBudget})` };
      }
      return { withinBudget: true };
    },
  };
}

function resolveOperator(env = process.env) {
  const name = typeof env.OPERATOR_NAME === 'string' ? env.OPERATOR_NAME.trim() : '';
  return name || 'non-identifié';
}

const defaultBudget = createBudgetTracker({
  maxTokensPerCall: process.env.FINOPS_MAX_TOKENS_PER_CALL,
  tokenBudget: process.env.FINOPS_TOKEN_BUDGET,
});

async function askHumanConfirmation(transaction) {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(
    `\n[worker] Remboursement demandé pour la transaction ${transaction.transactionId}. Confirmer ? (o/n) : `,
  );
  rl.close();
  return answer.trim().toLowerCase() === 'o';
}

async function callAnalysis(transaction, traceId) {
  const openai = observeOpenAI(new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  }), { traceId });

  const response = await openai.chat.completions.create({
    model: 'gemini-3.6-flash',
    messages: [{
      role: 'user',
      content: `Analyse cette notification de paiement et donne, en une phrase courte, ton verdict (normale ou suspecte) avec une brève justification : ${JSON.stringify(transaction)}`,
    }],
  });

  await openai.flushAsync();
  return {
    verdict: response.choices[0].message.content,
    totalTokens: response.usage.total_tokens,
  };
}

async function processTransaction(transaction, deps = {}) {
  const {
    analyze = callAnalysis,
    confirmHuman = askHumanConfirmation,
    langfuse = new Langfuse(),
    budget = defaultBudget,
    operator = resolveOperator(),
  } = deps;

  const traceId = randomUUID();
  const { verdict, totalTokens } = await analyze(transaction, traceId);
  console.log('[worker] AI analysis:', verdict);

  const budgetCheck = budget.record(totalTokens);
  if (!budgetCheck.withinBudget) {
    console.error(`[worker] ALERTE FINOPS : budget dépassé — ${budgetCheck.reason}`);
  }
  langfuse.score({
    traceId,
    name: 'finops_budget',
    value: budgetCheck.withinBudget ? 1 : 0,
  });

  if (transaction.status !== REFUND_STATUS) {
    await langfuse.flushAsync();
    return { verdict, refundApplied: false, humanAuthorized: null };
  }

  const authorized = await confirmHuman(transaction);

  langfuse.score({
    traceId,
    name: 'validation_humaine_remboursement',
    value: authorized ? 1 : 0,
    comment: `${authorized ? 'autorisé' : 'refusé'} par l'opérateur : ${operator}`,
  });
  await langfuse.flushAsync();

  if (!authorized) {
    console.log(`[worker] remboursement refusé par l'humain (opérateur : ${operator}) pour ${transaction.transactionId} — action annulée.`);
    return { verdict, refundApplied: false, humanAuthorized: false };
  }

  console.log(`[worker] remboursement autorisé par l'humain (opérateur : ${operator}) pour ${transaction.transactionId}.`);
  console.log(`[worker] order status updated: transactionId=${transaction.transactionId} status=Remboursé`);
  return { verdict, refundApplied: true, humanAuthorized: true };
}

async function main() {
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  const queueClient = await connectQueueWithRetry(REDIS_URL);
  console.log('[worker] connected to Redis, waiting for payment notifications...');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await queueClient.brPop(QUEUE_KEY, 0);
    const transaction = JSON.parse(job.element);
    console.log('[worker] processing transaction:', transaction);
    await processTransaction(transaction);
  }
}

module.exports = { processTransaction, createBudgetTracker, resolveOperator, REFUND_STATUS };

if (require.main === module) {
  main();
}
