const db = require('../db');

function nightsBetween(checkIn, checkOut) {
  return Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
}

// Возвращает либо { individual: true } — для случаев, которые тарифная сетка
// не покрывает (30+ ночей, см. TZ.md 8.9) и нужно обсуждать с менеджером
// лично, либо посчитанную цену.
async function calculatePricing(propertyId, checkIn, checkOut) {
  const nights = nightsBetween(checkIn, checkOut);
  const property = await db.get('SELECT * FROM properties WHERE id = ?', [propertyId]);

  const tier = await db.get(
    `SELECT * FROM pricing_tiers WHERE property_id = ? AND min_nights <= ?
     AND (max_nights IS NULL OR max_nights >= ?)
     ORDER BY min_nights DESC LIMIT 1`,
    [propertyId, nights, nights]
  );

  if (!tier) {
    return { individual: true, nights };
  }

  const totalAmount = tier.price_per_night * nights;
  const advanceAmount = Math.round((totalAmount * property.deposit_percent) / 100);

  return {
    individual: false,
    nights,
    pricePerNight: tier.price_per_night,
    tierLabel: tier.label,
    totalAmount,
    depositPercent: property.deposit_percent,
    advanceAmount,
    securityDeposit: property.security_deposit,
  };
}

module.exports = { calculatePricing, nightsBetween };
