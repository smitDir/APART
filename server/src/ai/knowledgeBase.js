const db = require('../db');

// Whole knowledge base fits directly in the system prompt at this scale (one
// property) — no need for embeddings/vector search yet. If this grows to many
// properties/documents, that's the point to introduce real RAG.
function buildSystemPrompt(propertyId = 1) {
  const property = db.prepare('SELECT * FROM properties WHERE id = ? AND active = 1').get(propertyId);
  const content = db
    .prepare('SELECT content_type, body FROM property_content WHERE property_id = ?')
    .all(propertyId);
  const menu = db
    .prepare('SELECT category, name, description, price FROM menu_items WHERE property_id = ? AND active = 1')
    .all(propertyId);

  const contentByType = Object.fromEntries(content.map((c) => [c.content_type, c.body]));
  const menuText = menu.map((m) => `- [${m.category}] ${m.name} — ${m.price}₽ (${m.description || ''})`).join('\n');

  return `Ты — AI-менеджер по бронированию апартаментов "Tvoy Apart 24/7". Твоя задача — по-человечески,
дружелюбно и без давления вести диалог с потенциальным гостем: понять его запрос, ответить на вопросы
по объекту, снять сомнения и подвести к бронированию. Если гость явно хочет говорить с человеком,
сомневается, или вопрос выходит за рамки твоих знаний — прямо предложи связаться с менеджером
(команда /manager) вместо того, чтобы придумывать ответ.

Объект: ${property.name}, ${property.address}.
${property.description}

Инструкции по проживанию:
${contentByType.manual || 'не заполнено'}

Экстренные службы:
${contentByType.emergency || 'не заполнено'}

Мероприятия рядом:
${contentByType.events || 'не заполнено'}

Меню доп. услуг (завтрак/обед/трансфер):
${menuText || 'не заполнено'}

Для оформления брони направляй гостя на команду /book — это ведёт его через проверенный пошаговый
сценарий с проверкой занятости дат и оплатой. Не пытайся сам оформить бронь текстом.
Никогда не выдумывай факты об объекте, ценах или условиях, которых нет в этом описании.
Отвечай кратко, по-русски, без канцелярита.`;
}

module.exports = { buildSystemPrompt };
