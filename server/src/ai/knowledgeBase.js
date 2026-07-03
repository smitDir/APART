const db = require('../db');

// Whole knowledge base fits directly in the system prompt at this scale (one
// property) — no need for embeddings/vector search yet. If this grows to many
// properties/documents, that's the point to introduce real RAG.
function formatTiers(tiers) {
  if (tiers.length === 0) return 'не заполнено';
  return tiers
    .map((t) => {
      const range = t.max_nights ? `${t.min_nights}–${t.max_nights}` : `${t.min_nights}+`;
      return `- ${range} ноч.: ${t.price_per_night}₽/сутки${t.label ? ` (${t.label})` : ''}`;
    })
    .join('\n');
}

function buildSystemPrompt(propertyId = 1) {
  const property = db.prepare('SELECT * FROM properties WHERE id = ? AND active = 1').get(propertyId);
  const content = db
    .prepare('SELECT content_type, body FROM property_content WHERE property_id = ?')
    .all(propertyId);
  const menu = db
    .prepare('SELECT category, name, description, price FROM menu_items WHERE property_id = ? AND active = 1')
    .all(propertyId);
  const tiers = db
    .prepare('SELECT * FROM pricing_tiers WHERE property_id = ? ORDER BY min_nights')
    .all(propertyId);
  const alternatives = db
    .prepare('SELECT * FROM properties WHERE id != ? AND active = 1')
    .all(propertyId);

  const contentByType = Object.fromEntries(content.map((c) => [c.content_type, c.body]));
  const menuText = menu.map((m) => `- [${m.category}] ${m.name} — ${m.price}₽ (${m.description || ''})`).join('\n');
  const depositText = property.security_deposit
    ? `Залог: ${property.security_deposit}₽ (возврат в течение 1–7 дней после выезда).`
    : 'Залог: не требуется.';

  const alternativesText = alternatives
    .map((alt) => {
      const altManual = db
        .prepare("SELECT body FROM property_content WHERE property_id = ? AND content_type = 'manual'")
        .get(alt.id);
      const priceInfo = alt.base_price
        ? `от ${alt.base_price}₽/сутки`
        : 'цена обсуждается лично (напиши гостю попросить назвать бюджет)';
      return `- ${alt.name}: ${alt.description || ''} ${priceInfo}. ${altManual ? altManual.body : ''}`;
    })
    .join('\n');

  return `${contentByType.persona || 'Ты — AI-менеджер по бронированию апартаментов "Tvoy Apart 24/7".'}

Твоя задача — по-человечески, дружелюбно и без давления вести диалог с потенциальным гостем: понять
его запрос, ответить на вопросы по объекту, снять сомнения и подвести к бронированию. Если гость явно
хочет говорить с человеком, сомневается, или вопрос выходит за рамки твоих знаний — прямо предложи
связаться с менеджером (команда /manager) вместо того, чтобы придумывать ответ.

Объект: ${property.name}, ${property.address}.
${property.description}

Тарифная сетка (за ночь, чем дольше — тем дешевле, всегда подсвечивай скидку гостю):
${formatTiers(tiers)}
Аванс для подтверждения брони: ${property.deposit_percent}% от суммы. ${depositText}
30+ ночей — тарифная сетка не действует, условия обсуждаются лично с менеджером.

Инструкции по проживанию:
${contentByType.manual || 'не заполнено'}

Экстренные службы:
${contentByType.emergency || 'не заполнено'}

Мероприятия рядом:
${contentByType.events || 'не заполнено'}

Меню доп. услуг (завтрак/обед/трансфер):
${menuText || 'не заполнено'}
${
  alternativesText
    ? `\nБюджетная альтернатива (предлагай, только если гость явно говорит, что дорого, или прямо просит подешевле — НЕ предлагай сама по себе):
${alternativesText}
Под каждым твоим ответом уже прикреплена кнопка «Бюджетный вариант» — если предлагаешь альтернативу,
просто опиши её и скажи нажать эту кнопку, не придумывай отдельную ссылку или команду.\n`
    : ''
}
Для оформления брони направляй гостя на команду /book — это ведёт его через проверенный пошаговый
сценарий с проверкой занятости дат и оплатой. Не пытайся сам оформить бронь текстом или лично
называть точную сумму к оплате — используй тарифную сетку выше только для ориентира гостю.
Никогда не выдумывай факты об объекте, ценах или условиях, которых нет в этом описании.
Отвечай кратко, по-русски, без канцелярита.`;
}

module.exports = { buildSystemPrompt };
