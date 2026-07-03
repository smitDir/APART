const express = require('express');
const { createBooking, BookingError } = require('../services/bookingService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await createBooking(req.body || {});
    res.json(result);
  } catch (err) {
    if (err instanceof BookingError) {
      const status = { validation: 400, not_found: 404, conflict: 409 }[err.code] || 400;
      return res.status(status).json({ error: err.message });
    }
    console.error('[bookings] unexpected error', err);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
