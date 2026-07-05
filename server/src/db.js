const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'apart',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'apart',
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true,
  dateStrings: true,
});

async function get(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0];
}

async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return { lastInsertRowid: result.insertId, changes: result.affectedRows };
}

// Runs `fn` with a connection-scoped { run } bound to a single MySQL
// transaction, committing on success and rolling back on any error.
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const tx = {
      run: async (sql, params = []) => {
        const [result] = await conn.query(sql, params);
        return { lastInsertRowid: result.insertId, changes: result.affectedRows };
      },
    };
    const result = await fn(tx);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS properties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    description TEXT,
    capacity INT NOT NULL DEFAULT 3,
    base_price INT,
    deposit_percent INT NOT NULL DEFAULT 30,
    security_deposit INT,
    active INT NOT NULL DEFAULT 1
  );

  -- Тарифная сетка по длительности проживания (скидки за долгий срок).
  -- Открытый верхний диапазон (max_nights IS NULL) — самый долгий тариф.
  CREATE TABLE IF NOT EXISTS pricing_tiers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    min_nights INT NOT NULL,
    max_nights INT,
    price_per_night INT NOT NULL,
    label TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    channel VARCHAR(16) NOT NULL DEFAULT 'web', -- 'web' | 'telegram_bot'
    full_name TEXT NOT NULL,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telegram VARCHAR(64),
    check_in VARCHAR(10) NOT NULL,
    check_out VARCHAR(10) NOT NULL,
    guests INT NOT NULL,
    children INT NOT NULL DEFAULT 0,
    purpose TEXT,
    payment_method VARCHAR(32) NOT NULL,
    services TEXT,
    comments TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    yookassa_payment_id VARCHAR(255),
    total_amount INT,
    advance_amount INT,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    category VARCHAR(32) NOT NULL, -- 'breakfast' | 'lunch' | 'transfer' | other
    name TEXT NOT NULL,
    description TEXT,
    price INT NOT NULL DEFAULT 0,
    active INT NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS booking_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1
  );

  -- Простое согласие в боте/на сайте (офферта-акцепт, не КЭП): факт + время + идентификатор.
  CREATE TABLE IF NOT EXISTS consents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT,
    telegram_user_id VARCHAR(64),
    document_type VARCHAR(64) NOT NULL, -- 'pd_processing' | 'rental_agreement' | 'house_rules'
    document_version VARCHAR(32) NOT NULL,
    accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Редактируемый статический контент по объекту: инструкции, экстренные службы, мероприятия.
  CREATE TABLE IF NOT EXISTS property_content (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    content_type VARCHAR(32) NOT NULL, -- 'manual' | 'emergency' | 'events'
    body TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Диалоговая память AI-бота (последние сообщения по каждому чату для контекста LLM).
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(64) NOT NULL,
    role VARCHAR(16) NOT NULL, -- 'user' | 'model'
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chat_messages_chat_id (chat_id)
  );

  -- Тема месяца для контент-плана (задаётся пользователем).
  CREATE TABLE IF NOT EXISTS content_themes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    month VARCHAR(7) NOT NULL, -- '2026-07'
    theme TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Логины для /admin/... — отдельно от Basic Auth (ADMIN_USER/ADMIN_PASSWORD),
  -- который остаётся только для существующих /api/admin/* эндпоинтов.
  CREATE TABLE IF NOT EXISTS admin_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    channel VARCHAR(32) NOT NULL, -- 'telegram' | 'youtube'
    content_type VARCHAR(16) NOT NULL DEFAULT 'photo', -- 'text' | 'photo' | 'video' | 'carousel'
    theme TEXT,
    week_of VARCHAR(10), -- дата понедельника недели, для группировки в еженедельное предложение
    caption TEXT,
    media_prompt TEXT,
    media_path TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'draft', -- 'draft' | 'approved' | 'generated' | 'posted' | 'failed'
    scheduled_at DATETIME,
    posted_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

async function seed() {
  const propertyCount = (await get('SELECT COUNT(*) AS n FROM properties')).n;
  if (propertyCount === 0) {
    const studio = await run(
      `INSERT INTO properties (name, address, description, capacity, base_price, deposit_percent, security_deposit, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        'Студия на Чистых Прудах',
        'Москва, Чистые Пруды',
        'Апартаменты 11 м² в историческом доме 1892 года. Коммунальные услуги (свет, вода, интернет) включены в стоимость.',
        3,
        10000,
        30,
        5000,
      ]
    );
    const studioId = studio.lastInsertRowid;

    // Бюджетный вариант — цена не зафиксирована (см. TZ.md 8.9): по сценарию это
    // персональный торг с гостем, а не фиксированный тариф, поэтому base_price=NULL.
    await run(
      `INSERT INTO properties (name, address, description, capacity, base_price, deposit_percent, security_deposit, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        'Комната в квартире',
        'Москва, Чистые Пруды',
        'Комната в квартире, бюджетный вариант. Доступ к общей кухне и ванной, личный замок, тихие соседи.',
        2,
        null,
        30,
        null,
      ]
    );

    await run(
      `INSERT INTO pricing_tiers (property_id, min_nights, max_nights, price_per_night, label) VALUES (?, ?, ?, ?, ?)`,
      [studioId, 1, 7, 10000, 'Базовый тариф']
    );
    await run(
      `INSERT INTO pricing_tiers (property_id, min_nights, max_nights, price_per_night, label) VALUES (?, ?, ?, ?, ?)`,
      [studioId, 8, 20, 9000, 'Скидка 10%']
    );
    await run(
      `INSERT INTO pricing_tiers (property_id, min_nights, max_nights, price_per_night, label) VALUES (?, ?, ?, ?, ?)`,
      [studioId, 21, 29, 8500, 'Скидка 15%']
    );
    // 30+ ночей — «Индивидуально» (см. TZ.md 8.9): не считаем автоматически,
    // передаём менеджеру на персональное обсуждение вместо фиксированной цены.
  }

  const menuCount = (await get('SELECT COUNT(*) AS n FROM menu_items')).n;
  if (menuCount === 0) {
    const menu = [
      ['breakfast', 'Классический завтрак', 'Яичница, тосты, сыр, овощи, сок', 600],
      ['breakfast', 'Овсяная каша с ягодами', 'Овсянка на молоке, свежие ягоды, мёд', 450],
      ['lunch', 'Бизнес-ланч', 'Суп, горячее, салат, компот', 900],
      ['transfer', 'Трансфер аэропорт/вокзал', 'Легковой автомобиль, встреча с табличкой', 1800],
    ];
    for (const [category, name, description, price] of menu) {
      await run(
        'INSERT INTO menu_items (property_id, category, name, description, price) VALUES (1, ?, ?, ?, ?)',
        [category, name, description, price]
      );
    }
  }

  const contentCount = (await get('SELECT COUNT(*) AS n FROM property_content')).n;
  if (contentCount === 0) {
    const emergencyText = 'Экстренные службы: Единый номер — 112. Полиция — 102. Скорая — 103. МЧС — 101.';
    const eventsText =
      'Черновик: подборка мероприятий рядом (музеи/театры/парки) — заполнить актуальным списком.';

    // Персона и политики продавца — общие для обоих объектов одного арендодателя.
    // См. TZ.md 8.9: пока дублируем на оба property_id, вместо отдельной таблицы
    // "глобального" контента — при 2 объектах это проще, чем городить абстракцию.
    const personaText = `Ты представляешь «Радогост» — сообщество хозяев, которые сдают апартаменты и комнаты
в самом сердце Москвы. Само имя — из старины: «рад» плюс «гость», радость встречи гостя. Это старый
обычай русского хлебосольства, а не безликое агентство с колл-центром.
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
      await run('INSERT INTO property_content (property_id, content_type, body) VALUES (?, ?, ?)', [
        propertyId,
        'emergency',
        emergencyText,
      ]);
      await run('INSERT INTO property_content (property_id, content_type, body) VALUES (?, ?, ?)', [
        propertyId,
        'events',
        eventsText,
      ]);
      await run('INSERT INTO property_content (property_id, content_type, body) VALUES (?, ?, ?)', [
        propertyId,
        'persona',
        personaText,
      ]);
    }

    await run('INSERT INTO property_content (property_id, content_type, body) VALUES (?, ?, ?)', [
      1,
      'manual',
      'Wi-Fi 100 Мбит/с включён в цену. Смарт-ТВ. Стиральная машина в квартире. ' +
        'Варочной плиты нет — есть мощная СВЧ с грилем, чайник, холодильник. ' +
        'Санузел совмещённый (душ, биде-функция). Бойлер — горячая вода круглосуточно. ' +
        '1-й этаж исторического дома 1892 года — лифта нет и не требуется.',
    ]);
    await run('INSERT INTO property_content (property_id, content_type, body) VALUES (?, ?, ?)', [
      2,
      'manual',
      'Черновик: инструкции по комнате (Wi-Fi, доступ к общей кухне/ванной, личный замок) — уточнить и заменить.',
    ]);
  }
}

// Уже развёрнутая БД создавалась до появления некоторых колонок — CREATE TABLE
// IF NOT EXISTS их туда не добавит, нужен явный ALTER для старых установок.
async function addColumnIfMissing(table, column, ddl) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (rows[0].n === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

async function migrate() {
  await addColumnIfMissing('bookings', 'channel', "channel VARCHAR(16) NOT NULL DEFAULT 'web' AFTER property_id");
  await addColumnIfMissing('bookings', 'deleted', 'deleted TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing('bookings', 'telegram', 'telegram VARCHAR(64) AFTER email');
}

// Первый /admin-логин наследуется от уже настроенных ADMIN_USER/ADMIN_PASSWORD,
// чтобы переход на хранение в БД не отрезал доступ владельцу.
async function seedAdminUser() {
  const count = (await get('SELECT COUNT(*) AS n FROM admin_users')).n;
  if (count === 0 && process.env.ADMIN_USER && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', [process.env.ADMIN_USER, hash]);
  }
}

async function init() {
  await pool.query(SCHEMA);
  await migrate();
  await seed();
  await seedAdminUser();
}

const ready = init();

module.exports = { pool, get, all, run, transaction, ready };
