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
  input[type=text], input[type=password], input[type=date], input[type=number], select, textarea { padding: 8px; border: 1px solid #ccc; border-radius: 5px; width: 100%; box-sizing: border-box; margin-bottom: 12px; font-family: inherit; }
  button { padding: 10px 20px; background: #4a3728; color: #fff; border: none; border-radius: 5px; cursor: pointer; }
  button.danger { background: #b00020; }
  .error { color: #b00020; margin-bottom: 12px; }
  form.login { max-width: 320px; margin: 60px auto; }
  form.edit { max-width: 480px; }
  label { display: block; font-weight: bold; margin-bottom: 4px; font-size: 13px; color: #4a3728; }
  .row-actions { display: flex; gap: 6px; }
  .row-actions form { display: inline; }
  .row-actions button, .row-actions a { padding: 4px 10px; font-size: 13px; }
  .row-actions a { display: inline-block; background: #f2e6d3; border-radius: 5px; text-decoration: none; }
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
const STATUS_OPTIONS = ['pending', 'paid', 'confirmed', 'cancelled'];
const PAYMENT_OPTIONS = ['card', 'transfer', 'link'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function selectOptions(options, current) {
  return options
    .map((o) => `<option value="${escapeHtml(o)}"${o === current ? ' selected' : ''}>${escapeHtml(o)}</option>`)
    .join('');
}

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
        <td class="row-actions">
          <a href="/admin/request/${b.id}/edit">Изменить</a>
          <form method="POST" action="/admin/request/${b.id}/delete" onsubmit="return confirm('Удалить заявку #${b.id}?')">
            <button type="submit" class="danger">Удалить</button>
          </form>
        </td>
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
            <th>Заезд</th><th>Выезд</th><th>Гостей</th><th>Статус</th><th>Оплата</th><th>Сумма</th><th>Аванс</th><th>Комментарий</th><th>Действия</th>
          </tr></thead>
          <tbody>${tableRows || '<tr><td colspan="16">Заявок пока нет.</td></tr>'}</tbody>
        </table>
      </div>`
    )
  );
});

router.get('/request/:id/edit', requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id);
  const b = await db.get('SELECT * FROM bookings WHERE id = ?', [id]);
  if (!b) {
    return res.status(404).send(pageShell('Не найдено', '<p>Заявка не найдена.</p><p><a href="/admin/request">← К списку</a></p>'));
  }

  res.send(
    pageShell(
      `Заявка #${id}`,
      `<h1>Редактирование заявки #${id}</h1>
      <form class="edit" method="POST" action="/admin/request/${id}/edit">
        <label>Имя</label>
        <input type="text" name="full_name" value="${escapeHtml(b.full_name)}" required>
        <label>Телефон</label>
        <input type="text" name="phone" value="${escapeHtml(b.phone)}" required>
        <label>Email</label>
        <input type="text" name="email" value="${escapeHtml(b.email)}" required>
        <label>Заезд (ГГГГ-ММ-ДД)</label>
        <input type="date" name="check_in" value="${escapeHtml(b.check_in)}" required>
        <label>Выезд (ГГГГ-ММ-ДД)</label>
        <input type="date" name="check_out" value="${escapeHtml(b.check_out)}" required>
        <label>Гостей</label>
        <input type="number" name="guests" min="1" value="${b.guests}" required>
        <label>Детей</label>
        <input type="number" name="children" min="0" value="${b.children}">
        <label>Статус</label>
        <select name="status">${selectOptions(STATUS_OPTIONS, b.status)}</select>
        <label>Способ оплаты</label>
        <select name="payment_method">${selectOptions(PAYMENT_OPTIONS, b.payment_method)}</select>
        <label>Сумма</label>
        <input type="number" name="total_amount" value="${b.total_amount ?? ''}">
        <label>Аванс</label>
        <input type="number" name="advance_amount" value="${b.advance_amount ?? ''}">
        <label>Комментарий</label>
        <textarea name="comments" rows="3">${escapeHtml(b.comments)}</textarea>
        <button type="submit">Сохранить</button>
      </form>
      <p><a href="/admin/request">← К списку</a></p>`
    )
  );
});

router.post('/request/:id/edit', requireAdminAuth, express.urlencoded({ extended: false }), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.get('SELECT id FROM bookings WHERE id = ?', [id]);
  if (!existing) return res.status(404).send(pageShell('Не найдено', '<p>Заявка не найдена.</p>'));

  const {
    full_name, phone, email, check_in, check_out, guests, children,
    status, payment_method, total_amount, advance_amount, comments,
  } = req.body || {};

  if (!full_name || !phone || !email || !DATE_RE.test(check_in) || !DATE_RE.test(check_out) || check_out <= check_in) {
    return res.status(400).send(
      pageShell('Ошибка', `<p class="error">Проверьте обязательные поля и даты (выезд должен быть позже заезда).</p><p><a href="/admin/request/${id}/edit">← Назад</a></p>`)
    );
  }

  await db.run(
    `UPDATE bookings SET
       full_name = ?, phone = ?, email = ?, check_in = ?, check_out = ?, guests = ?, children = ?,
       status = ?, payment_method = ?, total_amount = ?, advance_amount = ?, comments = ?
     WHERE id = ?`,
    [
      full_name,
      phone,
      email,
      check_in,
      check_out,
      Number(guests) || 1,
      Number(children) || 0,
      STATUS_OPTIONS.includes(status) ? status : 'pending',
      PAYMENT_OPTIONS.includes(payment_method) ? payment_method : 'transfer',
      total_amount === '' ? null : Number(total_amount),
      advance_amount === '' ? null : Number(advance_amount),
      comments || null,
      id,
    ]
  );
  res.redirect('/admin/request');
});

router.post('/request/:id/delete', requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM booking_items WHERE booking_id = ?', [id]);
    await tx.run('DELETE FROM consents WHERE booking_id = ?', [id]);
    await tx.run('DELETE FROM bookings WHERE id = ?', [id]);
  });
  res.redirect('/admin/request');
});

module.exports = { router, requireAdminAuth };
