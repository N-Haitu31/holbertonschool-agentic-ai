const express = require('express');

const QUEUE_KEY = 'payment-notifications';

function createApp(queueClient) {
  const app = express();
  app.use(express.json());

  app.post('/webhooks/payment', async (req, res) => {
    console.log('[payment-webhook] notification received:', JSON.stringify(req.body));
    await queueClient.lPush(QUEUE_KEY, JSON.stringify(req.body));
    res.sendStatus(200);
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.sendStatus(400);
    }
    next(err);
  });

  return app;
}

module.exports = { createApp, QUEUE_KEY };

if (require.main === module) {
  const { connectQueueWithRetry } = require('./queue.js');

  const PORT = process.env.PORT || 3000;
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  connectQueueWithRetry(REDIS_URL).then((queueClient) => {
    const app = createApp(queueClient);
    app.listen(PORT, () => {
      console.log(`[payment-webhook] listening on port ${PORT}`);
    });
  });
}
