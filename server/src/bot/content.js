const db = require('../db');

function getProperty(propertyId = 1) {
  return db.prepare('SELECT * FROM properties WHERE id = ? AND active = 1').get(propertyId);
}

function getContent(propertyId, contentType) {
  const row = db
    .prepare('SELECT body FROM property_content WHERE property_id = ? AND content_type = ?')
    .get(propertyId, contentType);
  return row ? row.body : 'Информация пока не заполнена.';
}

function getMenuItems(propertyId, category) {
  return db
    .prepare('SELECT * FROM menu_items WHERE property_id = ? AND category = ? AND active = 1')
    .all(propertyId, category);
}

function getMenuCategories(propertyId) {
  const rows = db
    .prepare('SELECT DISTINCT category FROM menu_items WHERE property_id = ? AND active = 1')
    .all(propertyId);
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
