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

module.exports = db;
