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
  .actions-bar { margin-top: 16px; text-align: left; }
  .btn { display: inline-block; padding: 10px 20px; background: #4a3728; color: #fff; border-radius: 5px; text-decoration: none; }
  form.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; margin-top: 16px; background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e0d0b8; }
  form.filters div { display: flex; flex-direction: column; }
  form.filters label { margin-bottom: 2px; }
  form.filters input, form.filters select { margin-bottom: 0; width: auto; }
  th a { color: #4a3728; text-decoration: none; }
  .pagination { margin-top: 16px; display: flex; gap: 8px; align-items: center; }
  .pagination a, .pagination span { padding: 6px 12px; border-radius: 5px; background: #f2e6d3; text-decoration: none; }
  .pagination .disabled { opacity: 0.4; pointer-events: none; }
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

const CHANNEL_LABELS = { web: 'Сайт', telegram_bot: 'Telegram-бот', admin: 'Админ (вручную)' };
const STATUS_OPTIONS = ['pending', 'paid', 'confirmed', 'cancelled'];
const PAYMENT_OPTIONS = ['card', 'transfer', 'link'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 20;

// Колонка -> реальное выражение для ORDER BY (белый список против SQL-инъекции через ?sort=).
const SORT_COLUMNS = {
  id: 'b.id',
  check_in: 'b.check_in',
  check_out: 'b.check_out',
  created_at: 'b.created_at',
  channel: 'b.channel',
  property_name: 'property_name',
  full_name: 'b.full_name',
  phone: 'b.phone',
  email: 'b.email',
  guests: 'b.guests',
  status: 'b.status',
  payment_method: 'b.payment_method',
  total_amount: 'b.total_amount',
  advance_amount: 'b.advance_amount',
};

function selectOptions(options, current) {
  return options
    .map((o) => `<option value="${escapeHtml(o)}"${o === current ? ' selected' : ''}>${escapeHtml(o)}</option>`)
    .join('');
}

// Строит querystring на основе текущих req.query с точечными переопределениями
// (используется и в ссылках сортировки/пагинации, и чтобы фильтры не терялись).
function qs(current, overrides) {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  return '?' + params.toString();
}

function sortLink(req, column, label) {
  const currentSort = req.query.sort || 'created_at';
  const currentDir = req.query.dir === 'asc' ? 'asc' : 'desc';
  const nextDir = currentSort === column && currentDir === 'asc' ? 'desc' : 'asc';
  const arrow = currentSort === column ? (currentDir === 'asc' ? ' ▲' : ' ▼') : '';
  return `<a href="${qs(req.query, { sort: column, dir: nextDir, page: 1 })}">${escapeHtml(label)}${arrow}</a>`;
}

router.get('/request', requireAdminAuth, async (req, res) => {
  const filters = [];
  const params = [];
  const f = req.query;

  if (f.check_in && DATE_RE.test(f.check_in)) {
    filters.push('b.check_in = ?');
    params.push(f.check_in);
  }
  if (f.check_out && DATE_RE.test(f.check_out)) {
    filters.push('b.check_out = ?');
    params.push(f.check_out);
  }
  if (f.full_name) {
    filters.push('b.full_name LIKE ?');
    params.push(`%${f.full_name}%`);
  }
  if (f.phone) {
    filters.push('b.phone LIKE ?');
    params.push(`%${f.phone}%`);
  }
  if (f.email) {
    filters.push('b.email LIKE ?');
    params.push(`%${f.email}%`);
  }
  if (f.status && STATUS_OPTIONS.includes(f.status)) {
    filters.push('b.status = ?');
    params.push(f.status);
  }
  if (f.guests && Number(f.guests)) {
    filters.push('b.guests = ?');
    params.push(Number(f.guests));
  }
  if (f.payment_method && PAYMENT_OPTIONS.includes(f.payment_method)) {
    filters.push('b.payment_method = ?');
    params.push(f.payment_method);
  }
  if (f.total_amount && Number(f.total_amount)) {
    filters.push('b.total_amount = ?');
    params.push(Number(f.total_amount));
  }

  const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMNS[f.sort] ? f.sort : 'created_at';
  const sortDir = f.dir === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, Number(f.page) || 1);

  const totalRow = await db.get(
    `SELECT COUNT(*) AS n FROM bookings b LEFT JOIN properties p ON p.id = b.property_id ${whereSql}`,
    params
  );
  const total = totalRow.n;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const rows = await db.all(
    `SELECT b.*, p.name AS property_name
     FROM bookings b
     LEFT JOIN properties p ON p.id = b.property_id
     ${whereSql}
     ORDER BY ${SORT_COLUMNS[sortColumn]} ${sortDir}
     LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    params
  );

  const tableRows = rows
    .map(
      (b) => `<tr>
        <td>${b.id}</td>
        <td>${escapeHtml(b.check_in)}</td>
        <td>${escapeHtml(b.check_out)}</td>
        <td>${escapeHtml(b.created_at)}</td>
        <td>${escapeHtml(CHANNEL_LABELS[b.channel] || b.channel)}</td>
        <td>${escapeHtml(b.property_name || b.property_id)}</td>
        <td>${escapeHtml(b.full_name)}</td>
        <td>${escapeHtml(b.phone)}</td>
        <td>${escapeHtml(b.email)}</td>
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

  const pagination = `
    <div class="pagination">
      <a class="${currentPage <= 1 ? 'disabled' : ''}" href="${qs(f, { page: currentPage - 1 })}">← Пред.</a>
      <span>Страница ${currentPage} из ${totalPages} (${total} заявок)</span>
      <a class="${currentPage >= totalPages ? 'disabled' : ''}" href="${qs(f, { page: currentPage + 1 })}">След. →</a>
    </div>`;

  res.send(
    pageShell(
      'Заявки на бронирование',
      `<div class="topbar">
        <h1>Заявки на бронирование (${total})</h1>
        <form method="POST" action="/admin/logout"><button type="submit">Выйти</button></form>
      </div>
      <div class="actions-bar">
        <a class="btn" href="/admin/request/new">+ Добавить заявку</a>
      </div>
      <form class="filters" method="GET" action="/admin/request">
        <div><label>Заезд</label><input type="date" name="check_in" value="${escapeHtml(f.check_in)}"></div>
        <div><label>Выезд</label><input type="date" name="check_out" value="${escapeHtml(f.check_out)}"></div>
        <div><label>Имя</label><input type="text" name="full_name" value="${escapeHtml(f.full_name)}"></div>
        <div><label>Телефон</label><input type="text" name="phone" value="${escapeHtml(f.phone)}"></div>
        <div><label>Email</label><input type="text" name="email" value="${escapeHtml(f.email)}"></div>
        <div><label>Статус</label><select name="status"><option value="">Любой</option>${selectOptions(STATUS_OPTIONS, f.status)}</select></div>
        <div><label>Гостей</label><input type="number" name="guests" min="1" value="${escapeHtml(f.guests)}"></div>
        <div><label>Оплата</label><select name="payment_method"><option value="">Любая</option>${selectOptions(PAYMENT_OPTIONS, f.payment_method)}</select></div>
        <div><label>Сумма</label><input type="number" name="total_amount" value="${escapeHtml(f.total_amount)}"></div>
        <div><button type="submit">Фильтр</button></div>
        <div><a class="btn" href="/admin/request">Сбросить</a></div>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>${sortLink(req, 'id', '#')}</th>
            <th>${sortLink(req, 'check_in', 'Заезд')}</th>
            <th>${sortLink(req, 'check_out', 'Выезд')}</th>
            <th>${sortLink(req, 'created_at', 'Создана')}</th>
            <th>${sortLink(req, 'channel', 'Канал')}</th>
            <th>${sortLink(req, 'property_name', 'Объект')}</th>
            <th>${sortLink(req, 'full_name', 'Имя')}</th>
            <th>${sortLink(req, 'phone', 'Телефон')}</th>
            <th>${sortLink(req, 'email', 'Email')}</th>
            <th>${sortLink(req, 'guests', 'Гостей')}</th>
            <th>${sortLink(req, 'status', 'Статус')}</th>
            <th>${sortLink(req, 'payment_method', 'Оплата')}</th>
            <th>${sortLink(req, 'total_amount', 'Сумма')}</th>
            <th>${sortLink(req, 'advance_amount', 'Аванс')}</th>
            <th>Комментарий</th><th>Действия</th>
          </tr></thead>
          <tbody>${tableRows || '<tr><td colspan="16">Заявок не найдено.</td></tr>'}</tbody>
        </table>
      </div>
      ${pagination}`
    )
  );
});

router.get('/request/new', requireAdminAuth, async (req, res) => {
  const properties = await db.all('SELECT id, name FROM properties WHERE active = 1');
  const propertyOptions = properties.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

  res.send(
    pageShell(
      'Новая заявка',
      `<h1>Новая заявка</h1>
      <form class="edit" method="POST" action="/admin/request/new">
        <label>Объект</label>
        <select name="property_id">${propertyOptions}</select>
        <label>Имя</label>
        <input type="text" name="full_name" required>
        <label>Телефон</label>
        <input type="text" name="phone" required>
        <label>Email</label>
        <input type="text" name="email" required>
        <label>Заезд (ГГГГ-ММ-ДД)</label>
        <input type="date" name="check_in" required>
        <label>Выезд (ГГГГ-ММ-ДД)</label>
        <input type="date" name="check_out" required>
        <label>Гостей</label>
        <input type="number" name="guests" min="1" value="1" required>
        <label>Детей</label>
        <input type="number" name="children" min="0" value="0">
        <label>Статус</label>
        <select name="status">${selectOptions(STATUS_OPTIONS, 'pending')}</select>
        <label>Способ оплаты</label>
        <select name="payment_method">${selectOptions(PAYMENT_OPTIONS, 'transfer')}</select>
        <label>Сумма</label>
        <input type="number" name="total_amount">
        <label>Аванс</label>
        <input type="number" name="advance_amount">
        <label>Комментарий</label>
        <textarea name="comments" rows="3"></textarea>
        <button type="submit">Создать</button>
      </form>
      <p><a href="/admin/request">← К списку</a></p>`
    )
  );
});

router.post('/request/new', requireAdminAuth, express.urlencoded({ extended: false }), async (req, res) => {
  const {
    property_id, full_name, phone, email, check_in, check_out, guests, children,
    status, payment_method, total_amount, advance_amount, comments,
  } = req.body || {};

  if (!full_name || !phone || !email || !DATE_RE.test(check_in) || !DATE_RE.test(check_out) || check_out <= check_in) {
    return res.status(400).send(
      pageShell('Ошибка', '<p class="error">Проверьте обязательные поля и даты (выезд должен быть позже заезда).</p><p><a href="/admin/request/new">← Назад</a></p>')
    );
  }

  const info = await db.run(
    `INSERT INTO bookings
     (property_id, channel, full_name, phone, email, check_in, check_out, guests, children, payment_method, status, total_amount, advance_amount, comments)
     VALUES (?, 'admin', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(property_id) || 1,
      full_name,
      phone,
      email,
      check_in,
      check_out,
      Number(guests) || 1,
      Number(children) || 0,
      PAYMENT_OPTIONS.includes(payment_method) ? payment_method : 'transfer',
      STATUS_OPTIONS.includes(status) ? status : 'pending',
      total_amount === '' || total_amount === undefined ? null : Number(total_amount),
      advance_amount === '' || advance_amount === undefined ? null : Number(advance_amount),
      comments || null,
    ]
  );
  res.redirect(`/admin/request/${info.lastInsertRowid}/edit`);
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
