const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function pageShell(title, body) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} — Tvoy Apart 24/7</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; margin: 0; padding: 24px; line-height: 1.5; color: #2c2c2c; background: #faf7f2; }
  h1 { color: #4a3728; font-size: 22px; margin: 0; }
  a { color: #4a3728; }
  table { border-collapse: collapse; width: 100%; background: #fff; font-size: 14px; }
  th, td { border: 1px solid #e0d0b8; padding: 6px 10px; text-align: left; white-space: nowrap; }
  th { background: #f2e6d3; color: #4a3728; }
  .table-wrap { overflow-x: auto; margin-top: 16px; }
  .topbar { display: flex; justify-content: space-between; align-items: center; }
  input[type=text], input[type=password] { padding: 8px; border: 1px solid #ccc; border-radius: 5px; width: 100%; box-sizing: border-box; margin-bottom: 12px; }
  button { padding: 10px 20px; background: #4a3728; color: #fff; border: none; border-radius: 5px; cursor: pointer; }
  .error { color: #b00020; margin-bottom: 12px; }
  form.login { max-width: 320px; margin: 60px auto; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function requireAdminAuth(req, res, next) {
  if (req.session && req.session.adminUserId) return next();
  res.redirect('/admin/login');
}

router.get('/', (req, res) => res.redirect('/admin/request'));

router.get('/login', (req, res) => {
  const error = req.query.error ? '<p class="error">Неверный логин или пароль.</p>' : '';
  res.send(
    pageShell(
      'Вход',
      `<form class="login" method="POST" action="/admin/login">
        <h1>Вход в админку</h1>
        ${error}
        <input type="text" name="username" placeholder="Логин" required autofocus>
        <input type="password" name="password" placeholder="Пароль" required>
        <button type="submit">Войти</button>
      </form>`
    )
  );
});

router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body || {};
  const user = username && (await db.get('SELECT * FROM admin_users WHERE username = ?', [username]));
  const ok = user && (await bcrypt.compare(password || '', user.password_hash));
  if (!ok) return res.redirect('/admin/login?error=1');
  req.session.adminUserId = user.id;
  res.redirect('/admin/request');
});

router.post('/logout', requireAdminAuth, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

const CHANNEL_LABELS = { web: 'Сайт', telegram_bot: 'Telegram-бот' };

router.get('/request', requireAdminAuth, async (req, res) => {
  const rows = await db.all(`
    SELECT b.*, p.name AS property_name
    FROM bookings b
    LEFT JOIN properties p ON p.id = b.property_id
    ORDER BY b.created_at DESC
  `);

  const tableRows = rows
    .map(
      (b) => `<tr>
        <td>${b.id}</td>
        <td>${escapeHtml(b.created_at)}</td>
        <td>${escapeHtml(CHANNEL_LABELS[b.channel] || b.channel)}</td>
        <td>${escapeHtml(b.property_name || b.property_id)}</td>
        <td>${escapeHtml(b.full_name)}</td>
        <td>${escapeHtml(b.phone)}</td>
        <td>${escapeHtml(b.email)}</td>
        <td>${escapeHtml(b.check_in)}</td>
        <td>${escapeHtml(b.check_out)}</td>
        <td>${b.guests}</td>
        <td>${escapeHtml(b.status)}</td>
        <td>${escapeHtml(b.payment_method)}</td>
        <td>${b.total_amount ?? ''}</td>
        <td>${b.advance_amount ?? ''}</td>
        <td>${escapeHtml(b.comments)}</td>
      </tr>`
    )
    .join('');

  res.send(
    pageShell(
      'Заявки на бронирование',
      `<div class="topbar">
        <h1>Заявки на бронирование (${rows.length})</h1>
        <form method="POST" action="/admin/logout"><button type="submit">Выйти</button></form>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Создана</th><th>Канал</th><th>Объект</th><th>Имя</th><th>Телефон</th><th>Email</th>
            <th>Заезд</th><th>Выезд</th><th>Гостей</th><th>Статус</th><th>Оплата</th><th>Сумма</th><th>Аванс</th><th>Комментарий</th>
          </tr></thead>
          <tbody>${tableRows || '<tr><td colspan="15">Заявок пока нет.</td></tr>'}</tbody>
        </table>
      </div>`
    )
  );
});

module.exports = { router, requireAdminAuth };
