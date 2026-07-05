// Создаёт или обновляет логин/пароль для /admin/... (таблица admin_users).
// Использование: node scripts/set-admin-password.js <username> <password>
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Использование: node scripts/set-admin-password.js <username> <password>');
    process.exit(1);
  }

  await db.ready;
  const hash = await bcrypt.hash(password, 10);
  const existing = await db.get('SELECT id FROM admin_users WHERE username = ?', [username]);
  if (existing) {
    await db.run('UPDATE admin_users SET password_hash = ? WHERE id = ?', [hash, existing.id]);
    console.log(`Пароль для "${username}" обновлён.`);
  } else {
    await db.run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', [username, hash]);
    console.log(`Пользователь "${username}" создан.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
