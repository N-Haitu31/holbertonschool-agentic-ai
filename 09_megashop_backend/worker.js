require('dotenv').config();

const OpenAI = require('openai');
const { observeOpenAI, Langfuse } = require('langfuse');
const { QUEUE_KEY } = require('./server.js');
const { connectQueueWithRetry } = require('./queue.js');

async function analyzeTransaction(transaction) {
  const langfuse = new Langfuse();

  const openai = observeOpenAI(new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  }));

  const response = await openai.chat.completions.create({
    model: 'gemini-3.6-flash',
    messages: [{
      role: 'user',
      content: `Analyse cette notification de paiement et donne, en une phrase courte, ton verdict (normale ou suspecte) avec une brève justification : ${JSON.stringify(transaction)}`,
    }],
  });

  await openai.flushAsync();
  await langfuse.flushAsync();

  return response.choices[0].message.content;
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

    const verdict = await analyzeTransaction(transaction);
    console.log('[worker] AI analysis:', verdict);
  }
}

module.exports = { analyzeTransaction };

if (require.main === module) {
  main();
}
