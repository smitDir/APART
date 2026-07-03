const express = require('express');
const db = require('../db');
const weeklyPlan = require('../content/weeklyPlan');

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

// Content queue: draft a post (caption + prompt for AI generation), then
// attach the generated media file once it exists (generation itself happens
// via the RunComfy CLI/skill, outside this server — see server/README.md).
router.get('/posts', basicAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM scheduled_posts ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/posts', basicAuth, (req, res) => {
  const { channel, caption, mediaPrompt, scheduledAt } = req.body || {};
  if (!channel || !['telegram', 'youtube'].includes(channel)) {
    return res.status(400).json({ error: 'channel must be telegram or youtube' });
  }
  const info = db
    .prepare(
      'INSERT INTO scheduled_posts (channel, caption, media_prompt, scheduled_at) VALUES (?, ?, ?, ?)'
    )
    .run(channel, caption || null, mediaPrompt || null, scheduledAt || null);
  res.json({ id: info.lastInsertRowid });
});

router.post('/posts/:id/media', basicAuth, (req, res) => {
  const id = Number(req.params.id);
  const { mediaPath } = req.body || {};
  if (!mediaPath) return res.status(400).json({ error: 'mediaPath required' });
  const post = db.prepare('SELECT * FROM scheduled_posts WHERE id = ?').get(id);
  if (!post) return res.status(404).json({ error: 'not found' });
  db.prepare("UPDATE scheduled_posts SET media_path = ?, status = 'generated' WHERE id = ?").run(mediaPath, id);
  res.json({ ok: true });
});

// Еженедельное предложение постов: создаётся одним пакетом (см. TZ.md 8.10),
// утверждается тоже целиком, а не по одному посту.
router.post('/posts/week', basicAuth, (req, res) => {
  const { weekOf, theme, posts } = req.body || {};
  if (!weekOf || !Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({ error: 'weekOf and non-empty posts[] required' });
  }
  weeklyPlan.createWeeklyProposal(weekOf, theme, posts);
  res.json({ ok: true, count: posts.length });
});

router.get('/posts/week/:weekOf', basicAuth, (req, res) => {
  res.json(weeklyPlan.getWeeklyProposal(req.params.weekOf));
});

router.post('/posts/week/:weekOf/approve', basicAuth, (req, res) => {
  const count = weeklyPlan.approveWeeklyProposal(req.params.weekOf);
  res.json({ ok: true, approved: count });
});

router.post('/themes', basicAuth, (req, res) => {
  const { month, theme, notes } = req.body || {};
  if (!month || !theme) return res.status(400).json({ error: 'month and theme required' });
  weeklyPlan.setMonthTheme(month, theme, notes);
  res.json({ ok: true });
});

module.exports = router;
