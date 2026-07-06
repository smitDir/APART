const db = require('../db');
const yookassa = require('../yookassa');
const { notifyTelegram, notifyManagerChannel } = require('../telegram');
const email = require('../email');
const { calculatePricing } = require('./pricing');

const BOT_USERNAME = 'tvoy_apart_bot';
const MANAGER_EMAIL = 'info@radegust.ru';
const ADMIN_BASE_URL = 'https://apart247.ru/admin';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class BookingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'validation' | 'conflict' | 'not_found'
  }
}

async function hasConflict(propertyId, checkIn, checkOut) {
  const overlap = await db.get(
    `SELECT COUNT(*) AS n FROM bookings
     WHERE property_id = ? AND status IN ('paid', 'confirmed')
     AND check_in < ? AND check_out > ?`,
    [propertyId, checkOut, checkIn]
  );
  return overlap.n > 0;
}

async function createBooking(input) {
  const {
    propertyId = 1,
    channel = 'web',
    contactChannel,
    fullName,
    phone,
    email: guestEmail,
    telegram,
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

  if (!fullName || !phone || !guestEmail || !checkIn || !checkOut || !guests || !payment || !consent) {
    throw new BookingError('validation', 'missing required fields');
  }
  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn) {
    throw new BookingError('validation', 'invalid date range');
  }

  const property = await db.get('SELECT * FROM properties WHERE id = ? AND active = 1', [propertyId]);
  if (!property) {
    throw new BookingError('not_found', 'property not found');
  }

  if (await hasConflict(propertyId, checkIn, checkOut)) {
    throw new BookingError('conflict', 'dates not available');
  }

  const pricing = await calculatePricing(propertyId, checkIn, checkOut);

  const info = await db.run(
    `INSERT INTO bookings
     (property_id, channel, full_name, phone, email, telegram, check_in, check_out, guests, children, purpose, payment_method, services, comments, status, total_amount, advance_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      propertyId,
      channel,
      fullName,
      phone,
      guestEmail,
      telegram || null,
      checkIn,
      checkOut,
      Number(guests),
      Number(children) || 0,
      purpose || null,
      payment,
      JSON.stringify(services),
      comments || null,
      pricing.individual ? null : pricing.totalAmount,
      pricing.individual ? null : pricing.advanceAmount,
    ]
  );
  const bookingId = info.lastInsertRowid;

  const priceNote = pricing.individual
    ? `${pricing.nights} ноч. — индивидуальные условия, требуют обсуждения с менеджером`
    : `${pricing.nights} ноч. × ${pricing.pricePerNight}₽ = ${pricing.totalAmount}₽, аванс ${pricing.advanceAmount}₽ (${pricing.depositPercent}%)`;
  const telegramLink = telegram && telegram.startsWith('@') ? `https://t.me/${telegram.slice(1)}` : telegram;
  const managerText =
    `🆕 Новая заявка #${bookingId}\n${fullName}, ${phone}\n${checkIn} → ${checkOut}, гостей: ${guests}\n${priceNote}\nОплата: ${payment}\n` +
    `Email: ${guestEmail}` +
    (telegramLink ? `\nTelegram: ${telegramLink}` : '') +
    `\nЗаявка в админке: ${ADMIN_BASE_URL}/request/${bookingId}/edit`;
  await notifyTelegram(managerText);
  await notifyManagerChannel(managerText);
  await email.sendEmail(MANAGER_EMAIL, `Новая заявка №${bookingId} — Tvoy Apart 24/7`, managerText);

  // Уведомление гостю: либо email, либо телеграм — по его выбору на сайте.
  // Bot API не даёт написать первым по свободно введённому @handle (нужен
  // chat_id, который появляется только после того, как гость сам напишет
  // боту) — поэтому для телеграма отдаём диплинк на бота с id заявки, а сам
  // бот присылает подтверждение, когда гость по нему перейдёт (см. /start в
  // bot/index.js). Бронирования из самого бота гость уже уведомляется напрямую
  // в finalizeBooking, тут это не дублируем.
  let telegramConfirmUrl = null;
  if (channel !== 'telegram_bot') {
    if (contactChannel === 'telegram' && telegram) {
      telegramConfirmUrl = `https://t.me/${BOT_USERNAME}?start=b${bookingId}`;
    } else {
      await email.sendEmail(
        guestEmail,
        `Заявка №${bookingId} принята — Tvoy Apart 24/7`,
        `${fullName}, здравствуйте!\n\nВаша заявка №${bookingId} на ${checkIn} → ${checkOut} принята и обрабатывается.\nМенеджер свяжется с вами для подтверждения.\n\nTvoy Apart 24/7`
      );
    }
  }

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
      await db.run('UPDATE bookings SET yookassa_payment_id = ? WHERE id = ?', [paymentObj.id, bookingId]);
      confirmationUrl = paymentObj.confirmation?.confirmation_url || null;
    } catch (err) {
      console.error('[bookingService] payment creation failed', err);
    }
  }

  return { bookingId, status: 'pending', confirmationUrl, telegramConfirmUrl, pricing };
}

async function addBookingItems(bookingId, items) {
  await db.transaction(async (tx) => {
    for (const row of items) {
      await tx.run('INSERT INTO booking_items (booking_id, menu_item_id, quantity) VALUES (?, ?, ?)', [
        bookingId,
        row.menuItemId,
        row.quantity || 1,
      ]);
    }
  });
}

module.exports = { createBooking, addBookingItems, hasConflict, BookingError };
