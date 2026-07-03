const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'data.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    description TEXT,
    capacity INTEGER NOT NULL DEFAULT 3,
    base_price INTEGER,
    deposit_percent INTEGER NOT NULL DEFAULT 30,
    security_deposit INTEGER,
    active INTEGER NOT NULL DEFAULT 1
  );

  -- Тарифная сетка по длительности проживания (скидки за долгий срок).
  -- Открытый верхний диапазон (max_nights IS NULL) — самый долгий тариф.
  CREATE TABLE IF NOT EXISTS pricing_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    min_nights INTEGER NOT NULL,
    max_nights INTEGER,
    price_per_night INTEGER NOT NULL,
    label TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    guests INTEGER NOT NULL,
    children INTEGER NOT NULL DEFAULT 0,
    purpose TEXT,
    payment_method TEXT NOT NULL,
    services TEXT,
    comments TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    yookassa_payment_id TEXT,
    total_amount INTEGER,
    advance_amount INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    category TEXT NOT NULL, -- 'breakfast' | 'lunch' | 'transfer' | other
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS booking_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
    quantity INTEGER NOT NULL DEFAULT 1
  );

  -- Простое согласие в боте/на сайте (офферта-акцепт, не КЭП): факт + время + идентификатор.
  CREATE TABLE IF NOT EXISTS consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER REFERENCES bookings(id),
    telegram_user_id TEXT,
    document_type TEXT NOT NULL, -- 'pd_processing' | 'rental_agreement' | 'house_rules'
    document_version TEXT NOT NULL,
    accepted_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Редактируемый статический контент по объекту: инструкции, экстренные службы, мероприятия.
  CREATE TABLE IF NOT EXISTS property_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    content_type TEXT NOT NULL, -- 'manual' | 'emergency' | 'events'
    body TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Диалоговая память AI-бота (последние сообщения по каждому чату для контекста LLM).
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user' | 'model'
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);

  -- Тема месяца для контент-плана (задаётся пользователем).
  CREATE TABLE IF NOT EXISTS content_themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL, -- '2026-07'
    theme TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL, -- 'telegram' | 'youtube'
    content_type TEXT NOT NULL DEFAULT 'photo', -- 'text' | 'photo' | 'video'
    theme TEXT,
    week_of TEXT, -- дата понедельника недели, для группировки в еженедельное предложение
    caption TEXT,
    media_prompt TEXT,
    media_path TEXT,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'approved' | 'generated' | 'posted' | 'failed'
    scheduled_at TEXT,
    posted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const propertyCount = db.prepare('SELECT COUNT(*) AS n FROM properties').get().n;
if (propertyCount === 0) {
  const insertProperty = db.prepare(
    `INSERT INTO properties (name, address, description, capacity, base_price, deposit_percent, security_deposit, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  );
  const studioId = insertProperty.run(
    'Студия на Чистых Прудах',
    'Москва, Чистые Пруды',
    'Апартаменты 11 м² в историческом доме 1892 года. Коммунальные услуги (свет, вода, интернет) включены в стоимость.',
    3,
    10000,
    30,
    5000
  ).lastInsertRowid;

  // Бюджетный вариант — цена не зафиксирована (см. TZ.md 8.9): по сценарию это
  // персональный торг с гостем, а не фиксированный тариф, поэтому base_price=NULL.
  insertProperty.run(
    'Комната в квартире',
    'Москва, Чистые Пруды',
    'Комната в квартире, бюджетный вариант. Доступ к общей кухне и ванной, личный замок, тихие соседи.',
    2,
    null,
    30,
    null
  );

  const insertTier = db.prepare(
    `INSERT INTO pricing_tiers (property_id, min_nights, max_nights, price_per_night, label) VALUES (?, ?, ?, ?, ?)`
  );
  insertTier.run(studioId, 1, 7, 10000, 'Базовый тариф');
  insertTier.run(studioId, 8, 20, 9000, 'Скидка 10%');
  insertTier.run(studioId, 21, 29, 8500, 'Скидка 15%');
  // 30+ ночей — «Индивидуально» (см. TZ.md 8.9): не считаем автоматически,
  // передаём менеджеру на персональное обсуждение вместо фиксированной цены.
}

const menuCount = db.prepare('SELECT COUNT(*) AS n FROM menu_items').get().n;
if (menuCount === 0) {
  const insertMenu = db.prepare(
    `INSERT INTO menu_items (property_id, category, name, description, price) VALUES (1, ?, ?, ?, ?)`
  );
  insertMenu.run('breakfast', 'Классический завтрак', 'Яичница, тосты, сыр, овощи, сок', 600);
  insertMenu.run('breakfast', 'Овсяная каша с ягодами', 'Овсянка на молоке, свежие ягоды, мёд', 450);
  insertMenu.run('lunch', 'Бизнес-ланч', 'Суп, горячее, салат, компот', 900);
  insertMenu.run('transfer', 'Трансфер аэропорт/вокзал', 'Легковой автомобиль, встреча с табличкой', 1800);
}

const contentCount = db.prepare('SELECT COUNT(*) AS n FROM property_content').get().n;
if (contentCount === 0) {
  const insertContent = db.prepare(
    `INSERT INTO property_content (property_id, content_type, body) VALUES (?, ?, ?)`
  );

  const emergencyText = 'Экстренные службы: Единый номер — 112. Полиция — 102. Скорая — 103. МЧС — 101.';
  const eventsText =
    'Черновик: подборка мероприятий рядом (музеи/театры/парки) — заполнить актуальным списком.';

  // Персона и политики продавца — общие для обоих объектов одного арендодателя.
  // См. TZ.md 8.9: пока дублируем на оба property_id, вместо отдельной таблицы
  // "глобального" контента — при 2 объектах это проще, чем городить абстракцию.
  const personaText = `Ты представляешь частного арендодателя (физическое лицо), а не агентство.
Стиль: дружелюбно, по-человечески, «без галстуков», но на «Вы». Никакого канцелярита.
Принципы: прямое общение без комиссий агентств; честность (реальные фото, о недостатках говоришь заранее);
гибкость по цене для долгих гостей; забота (маршрут, встреча, совет по району).

Условия оплаты: предоплата 30% от суммы брони фиксирует даты, остаток — при заезде или по ссылке.
Залог 5000 ₽ (блокируется или наличными), возврат в течение 1–7 дней после выезда.
Не запрашивай паспортные данные и полные реквизиты карт в чате — это только для договора,
через защищённый канал или при личной встрече (152-ФЗ).

Политика отмены: бесплатная отмена при отказе более чем за 72 часа до заезда.
Если позже — удерживается 50% предоплаты в счёт компенсации простоя.

Работа с возражениями:
— Про отсутствие плиты: честно говори, что её нет, но есть мощная СВЧ и мини-кухня для завтраков,
  рядом рестораны с доставкой для сложных блюд.
— Про отсутствие лифта: это 1-й этаж исторического дома — лифт не нужен, удобно с багажом.
— Про цену: объясняй ценность локации, прямое общение без комиссий, включённые коммуналку и интернет,
  и что при 8+ ночах уже действует скидка.
— Если гость ищет максимально бюджетный вариант — не отказывай сразу: предложи "Комнату в квартире"
  или уточни даты на предмет спецпредложения, прежде чем эскалировать к менеджеру.`;

  for (const propertyId of [1, 2]) {
    insertContent.run(propertyId, 'emergency', emergencyText);
    insertContent.run(propertyId, 'events', eventsText);
    insertContent.run(propertyId, 'persona', personaText);
  }

  insertContent.run(
    1,
    'manual',
    'Wi-Fi 100 Мбит/с включён в цену. Смарт-ТВ. Стиральная машина в квартире. ' +
      'Варочной плиты нет — есть мощная СВЧ с грилем, чайник, холодильник. ' +
      'Санузел совмещённый (душ, биде-функция). Бойлер — горячая вода круглосуточно. ' +
      '1-й этаж исторического дома 1892 года — лифта нет и не требуется.'
  );
  insertContent.run(
    2,
    'manual',
    'Черновик: инструкции по комнате (Wi-Fi, доступ к общей кухне/ванной, личный замок) — уточнить и заменить.'
  );
}

module.exports = db;
