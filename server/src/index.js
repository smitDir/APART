require('dotenv').config();
const express = require('express');
const cors = require('cors');

const db = require('./db');
const propertiesRouter = require('./routes/properties');
const bookingsRouter = require('./routes/bookings');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');
const { startBot } = require('./bot');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

app.use('/api/properties', propertiesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;

db.ready
  .then(() => {
    app.listen(port, () => console.log(`apart-server listening on :${port}`));
    startBot();
  })
  .catch((err) => {
    console.error('[index] database init failed', err);
    process.exit(1);
  });
