require('dotenv').config();

const OpenAI = require('openai');
const { observeOpenAI, Langfuse } = require('langfuse');
const { randomUUID } = require('node:crypto');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { QUEUE_KEY } = require('./server.js');
const { connectQueueWithRetry } = require('./queue.js');

const REFUND_STATUS = 'refund';

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
  return response.choices[0].message.content;
}

async function processTransaction(transaction, deps = {}) {
  const {
    analyze = callAnalysis,
    confirmHuman = askHumanConfirmation,
    langfuse = new Langfuse(),
  } = deps;

  const traceId = randomUUID();
  const verdict = await analyze(transaction, traceId);
  console.log('[worker] AI analysis:', verdict);

  if (transaction.status !== REFUND_STATUS) {
    return { verdict, refundApplied: false, humanAuthorized: null };
  }

  const authorized = await confirmHuman(transaction);

  langfuse.score({
    traceId,
    name: 'validation_humaine_remboursement',
    value: authorized ? 1 : 0,
  });
  await langfuse.flushAsync();

  if (!authorized) {
    console.log(`[worker] remboursement refusé par l'humain pour ${transaction.transactionId} — action annulée.`);
    return { verdict, refundApplied: false, humanAuthorized: false };
  }

  console.log(`[worker] remboursement autorisé par l'humain pour ${transaction.transactionId}.`);
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

module.exports = { processTransaction, REFUND_STATUS };

if (require.main === module) {
  main();
}
