const express = require('express');
const db = require('../db');
const yookassa = require('../yookassa');
const { notifyTelegram } = require('../telegram');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function hasConflict(propertyId, checkIn, checkOut) {
  const overlap = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings
       WHERE property_id = ? AND status IN ('paid', 'confirmed')
       AND check_in < ? AND check_out > ?`
    )
    .get(propertyId, checkOut, checkIn);
  return overlap.n > 0;
}

router.post('/', async (req, res) => {
  const {
    propertyId = 1,
    fullName,
    phone,
    email,
    checkIn,
    checkOut,
    guests,
    children = 0,
    purpose,
    payment,
    services = [],
    comments,
    consent,
  } = req.body || {};

  if (!fullName || !phone || !email || !checkIn || !checkOut || !guests || !payment || !consent) {
    return res.status(400).json({ error: 'missing required fields' });
  }
  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn) {
    return res.status(400).json({ error: 'invalid date range' });
  }

  const property = db.prepare('SELECT * FROM properties WHERE id = ? AND active = 1').get(propertyId);
  if (!property) {
    return res.status(404).json({ error: 'property not found' });
  }

  if (hasConflict(propertyId, checkIn, checkOut)) {
    return res.status(409).json({ error: 'dates not available' });
  }

  const insert = db.prepare(
    `INSERT INTO bookings
     (property_id, full_name, phone, email, check_in, check_out, guests, children, purpose, payment_method, services, comments, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  );
  const info = insert.run(
    propertyId,
    fullName,
    phone,
    email,
    checkIn,
    checkOut,
    Number(guests),
    Number(children) || 0,
    purpose || null,
    payment,
    JSON.stringify(services),
    comments || null
  );
  const bookingId = info.lastInsertRowid;

  await notifyTelegram(
    `🆕 Новая заявка #${bookingId}\n${fullName}, ${phone}\n${checkIn} → ${checkOut}, гостей: ${guests}\nОплата: ${payment}`
  );

  if (payment === 'link' && yookassa.isConfigured()) {
    try {
      const nights = Math.round(
        (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)
      );
      const amount = (property.base_price || 0) * nights;
      const payment_ = await yookassa.createPayment({
        amount: amount > 0 ? amount : 1,
        description: `Бронирование #${bookingId}, ${property.name}`,
        bookingId,
        returnUrl: process.env.BOOKING_RETURN_URL || 'https://radegust.ru/lending/apart/',
      });
      db.prepare('UPDATE bookings SET yookassa_payment_id = ? WHERE id = ?').run(
        payment_.id,
        bookingId
      );
      return res.json({
        bookingId,
        status: 'pending',
        confirmationUrl: payment_.confirmation?.confirmation_url || null,
      });
    } catch (err) {
      console.error('[bookings] payment creation failed', err);
      return res.json({ bookingId, status: 'pending', confirmationUrl: null });
    }
  }

  res.json({ bookingId, status: 'pending', confirmationUrl: null });
});

module.exports = router;
