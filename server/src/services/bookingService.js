const db = require('../db');
const yookassa = require('../yookassa');
const { notifyTelegram } = require('../telegram');
const { calculatePricing } = require('./pricing');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class BookingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'validation' | 'conflict' | 'not_found'
  }
}

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

async function createBooking(input) {
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
  } = input;

  if (!fullName || !phone || !email || !checkIn || !checkOut || !guests || !payment || !consent) {
    throw new BookingError('validation', 'missing required fields');
  }
  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn) {
    throw new BookingError('validation', 'invalid date range');
  }

  const property = db.prepare('SELECT * FROM properties WHERE id = ? AND active = 1').get(propertyId);
  if (!property) {
    throw new BookingError('not_found', 'property not found');
  }

  if (hasConflict(propertyId, checkIn, checkOut)) {
    throw new BookingError('conflict', 'dates not available');
  }

  const pricing = calculatePricing(propertyId, checkIn, checkOut);

  const insert = db.prepare(
    `INSERT INTO bookings
     (property_id, full_name, phone, email, check_in, check_out, guests, children, purpose, payment_method, services, comments, status, total_amount, advance_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
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
    comments || null,
    pricing.individual ? null : pricing.totalAmount,
    pricing.individual ? null : pricing.advanceAmount
  );
  const bookingId = info.lastInsertRowid;

  const priceNote = pricing.individual
    ? `${pricing.nights} ноч. — индивидуальные условия, требуют обсуждения с менеджером`
    : `${pricing.nights} ноч. × ${pricing.pricePerNight}₽ = ${pricing.totalAmount}₽, аванс ${pricing.advanceAmount}₽ (${pricing.depositPercent}%)`;
  await notifyTelegram(
    `🆕 Новая заявка #${bookingId}\n${fullName}, ${phone}\n${checkIn} → ${checkOut}, гостей: ${guests}\n${priceNote}\nОплата: ${payment}`
  );

  let confirmationUrl = null;
  // 30+ ночей — не выставляем автоматический счёт, это персональные условия
  // (см. TZ.md 8.9), менеджер связывается с гостем напрямую.
  if (payment === 'link' && !pricing.individual && yookassa.isConfigured()) {
    try {
      const paymentObj = await yookassa.createPayment({
        amount: pricing.advanceAmount,
        description: `Аванс 30% за бронирование #${bookingId}, ${property.name}`,
        bookingId,
        returnUrl: process.env.BOOKING_RETURN_URL || 'https://radegust.ru/lending/apart/',
      });
      db.prepare('UPDATE bookings SET yookassa_payment_id = ? WHERE id = ?').run(paymentObj.id, bookingId);
      confirmationUrl = paymentObj.confirmation?.confirmation_url || null;
    } catch (err) {
      console.error('[bookingService] payment creation failed', err);
    }
  }

  return { bookingId, status: 'pending', confirmationUrl, pricing };
}

function addBookingItems(bookingId, items) {
  const insert = db.prepare(
    'INSERT INTO booking_items (booking_id, menu_item_id, quantity) VALUES (?, ?, ?)'
  );
  const tx = db.transaction((rows) => {
    for (const row of rows) insert.run(bookingId, row.menuItemId, row.quantity || 1);
  });
  tx(items);
}

module.exports = { createBooking, addBookingItems, hasConflict, BookingError };
