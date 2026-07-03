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
    active INTEGER NOT NULL DEFAULT 1
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

  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL, -- 'telegram' | 'youtube'
    caption TEXT,
    media_prompt TEXT,
    media_path TEXT,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'generated' | 'posted' | 'failed'
    scheduled_at TEXT,
    posted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const propertyCount = db.prepare('SELECT COUNT(*) AS n FROM properties').get().n;
if (propertyCount === 0) {
  db.prepare(
    `INSERT INTO properties (name, address, description, capacity, base_price, active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(
    'Студия на Чистых Прудах',
    'Москва, Чистые Пруды',
    'Апартаменты 11 м² в историческом доме 1892 года',
    3,
    null
  );
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
    `INSERT INTO property_content (property_id, content_type, body) VALUES (1, ?, ?)`
  );
  insertContent.run(
    'manual',
    'Черновик: инструкции по бытовым приборам (Wi-Fi, стиральная машина, СВЧ, бойлер) — уточнить у владельца и заменить этот текст.'
  );
  insertContent.run(
    'emergency',
    'Экстренные службы: Единый номер — 112. Полиция — 102. Скорая — 103. МЧС — 101.'
  );
  insertContent.run(
    'events',
    'Черновик: подборка мероприятий рядом (музеи/театры/парки) — заполнить актуальным списком.'
  );
}

module.exports = db;
