const crypto = require('crypto');
const fetch = require('node-fetch');

const API_URL = 'https://api.yookassa.ru/v3/payments';

function isConfigured() {
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

async function createPayment({ amount, description, bookingId, returnUrl }) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
  const idempotenceKey = crypto.randomUUID();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
    },
    body: JSON.stringify({
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: returnUrl },
      capture: true,
      description,
      metadata: { bookingId: String(bookingId) },
    }),
  });

  if (!res.ok) {
    throw new Error(`YooKassa payment creation failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function getPayment(paymentId) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

  const res = await fetch(`${API_URL}/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`YooKassa payment lookup failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

module.exports = { isConfigured, createPayment, getPayment };
