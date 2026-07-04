const express = require('express');
const db = require('../db');
const yookassa = require('../yookassa');
const { notifyTelegram } = require('../telegram');

const router = express.Router();

// We don't trust the webhook body's payment status directly (no signature
// support in YooKassa webhooks) — instead we look up the payment id it
// reports and re-fetch its real status via our own authenticated API call.
router.post('/yookassa', async (req, res) => {
  const paymentId = req.body?.object?.id;
  if (!paymentId) {
    return res.status(400).end();
  }

  res.status(200).end(); // acknowledge immediately, YooKassa retries on non-2xx

  try {
    const payment = await yookassa.getPayment(paymentId);
    if (payment.status !== 'succeeded') return;

    const booking = await db.get('SELECT * FROM bookings WHERE yookassa_payment_id = ?', [paymentId]);
    if (!booking || booking.status === 'confirmed') return;

    await db.run("UPDATE bookings SET status = 'confirmed' WHERE id = ?", [booking.id]);
    await notifyTelegram(
      `✅ Оплата подтверждена, бронь #${booking.id}\n${booking.full_name}, ${booking.check_in} → ${booking.check_out}`
    );
  } catch (err) {
    console.error('[webhook] yookassa processing failed', err);
  }
});

module.exports = router;
