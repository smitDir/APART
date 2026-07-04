const db = require('../db');

async function getProperty(propertyId = 1) {
  return db.get('SELECT * FROM properties WHERE id = ? AND active = 1', [propertyId]);
}

async function getContent(propertyId, contentType) {
  const row = await db.get('SELECT body FROM property_content WHERE property_id = ? AND content_type = ?', [
    propertyId,
    contentType,
  ]);
  return row ? row.body : 'Информация пока не заполнена.';
}

async function getMenuItems(propertyId, category) {
  return db.all('SELECT * FROM menu_items WHERE property_id = ? AND category = ? AND active = 1', [
    propertyId,
    category,
  ]);
}

async function getMenuCategories(propertyId) {
  const rows = await db.all('SELECT DISTINCT category FROM menu_items WHERE property_id = ? AND active = 1', [
    propertyId,
  ]);
  return rows.map((r) => r.category);
}

const MANAGER_CONTACT =
  '📞 Телефон: +7 (926) 227-99-55\n✈ Telegram: t.me/+p21HdAFjikg1NDky\n📧 Email: sale@radegust.ru\nВремя работы: ежедневно, 09:00–22:00 (Москва)';

const CATEGORY_LABELS = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  transfer: 'Трансфер',
};

module.exports = { getProperty, getContent, getMenuItems, getMenuCategories, MANAGER_CONTACT, CATEGORY_LABELS };
