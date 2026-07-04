const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const properties = await db.all('SELECT * FROM properties WHERE active = 1');
  res.json(properties);
});

router.get('/:id/availability', async (req, res) => {
  const propertyId = Number(req.params.id);
  if (!Number.isInteger(propertyId)) {
    return res.status(400).json({ error: 'invalid property id' });
  }

  const rows = await db.all(
    `SELECT check_in, check_out FROM bookings
     WHERE property_id = ? AND status IN ('paid', 'confirmed')
     ORDER BY check_in`,
    [propertyId]
  );

  res.json(rows.map((r) => ({ checkIn: r.check_in, checkOut: r.check_out })));
});

module.exports = router;
