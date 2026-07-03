const express = require('express');
const db = require('../db');

const router = express.Router();

function basicAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic');
    return res.status(401).end();
  }
  const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
  if (user !== process.env.ADMIN_USER || pass !== process.env.ADMIN_PASSWORD) {
    res.set('WWW-Authenticate', 'Basic');
    return res.status(401).end();
  }
  next();
}

router.get('/bookings', basicAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
  res.json(rows);
});

// For payment methods that don't go through the YooKassa webhook (bank
// transfer, cash) — the manager confirms manually once payment is verified.
router.post('/bookings/:id/confirm', basicAuth, (req, res) => {
  const id = Number(req.params.id);
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  if (!booking) return res.status(404).json({ error: 'not found' });
  db.prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?").run(id);
  res.json({ ok: true });
});

module.exports = router;
