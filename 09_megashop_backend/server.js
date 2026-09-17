const express = require('express');

const app = express();
app.use(express.json());

app.post('/webhooks/payment', (req, res) => {
  console.log('[payment-webhook] notification received:', JSON.stringify(req.body));
  res.sendStatus(200);
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.sendStatus(400);
  }
  next(err);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[payment-webhook] listening on port ${PORT}`);
  });
}

module.exports = app;
