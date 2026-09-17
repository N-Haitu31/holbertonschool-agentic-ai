const { createClient } = require('redis');

async function connectQueueWithRetry(url, { retryDelayMs = 2000 } = {}) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const client = createClient({ url });
    try {
      await client.connect();
      return client;
    } catch (err) {
      console.error(`[queue] connection to Redis failed (${err.message}), retrying in ${retryDelayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

module.exports = { connectQueueWithRetry };
