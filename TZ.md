# ТЗ и архитектура: Tvoy Apart 24/7 — система бронирования

## 1. Контекст

- Лендинг: `index.html`, размещён по адресу `radegust.ru/lending/apart/` (путь на существующем хостинге).
- Сейчас 1 объект: студия 11 м², Чистые Пруды. План — добавлять новые объекты.
- Форма брони на лендинге сейчас никуда не отправляется (нет backend).

## 2. Решения по архитектуре

| Вопрос | Решение |
|---|---|
| Масштаб | Мультиобъектная модель данных с самого начала (`property_id`), даже при 1 объекте сейчас |
| Подтверждение брони | Автоматически, по вебхуку об успешной оплате ЮKassa |
| Календарь занятости | Да, на лендинге — виджет на vanilla JS, тянет занятые даты с API |
| Оркестратор | Свой лёгкий backend (Node.js/Express), без n8n — меньше движущихся частей для CRUD + webhook-логики |
| БД | SQLite (`better-sqlite3`) — один файл, миграция на Postgres возможна позже без переписывания |
| Домен | Лендинг остаётся на `radegust.ru/lending/apart/`; API разворачивается на отдельном поддомене (например `api.radegust.ru`) на VPS, чтобы не трогать текущий хостинг |
| Уведомления | Telegram Bot API напрямую (HTTP-запрос), опционально email по SMTP |

## 3. Модель данных

**properties**
- id, name, address, description, capacity, base_price, active

**bookings**
- id, property_id, full_name, phone, email, check_in, check_out, guests, children, purpose, payment_method, services (JSON-массив), comments, status (`pending` / `paid` / `confirmed` / `cancelled`), yookassa_payment_id, created_at

Занятость объекта = диапазоны дат броней со статусом `paid`/`confirmed`, пересекающиеся по датам. Отдельная таблица календаря не нужна — считается запросом.

## 4. API

- `GET /api/properties` — список объектов
- `GET /api/properties/:id/availability?from=&to=` — занятые диапазоны дат
- `POST /api/bookings` — создать заявку; проверяет конфликт дат; если `payment=link` — создаёт платёж в ЮKassa и возвращает `confirmationUrl`
- `POST /api/webhooks/yookassa` — приём уведомления об оплате; проверка подписи/IP; перевод брони в `confirmed`; уведомление в Telegram
- `GET /api/admin/bookings` — список броней (Basic Auth), для менеджера

## 5. Развёртывание (после установки VPS)

1. VPS: Node.js 20+, nginx как reverse proxy, certbot для HTTPS.
2. Поддомен `api.radegust.ru` → проксирует на `localhost:3000` (порт backend).
3. `.env` с реальными секретами: `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_PASSWORD`.
4. Backend как systemd-сервис (`pm2` или `systemd unit`), автозапуск при перезагрузке.
5. В `index.html` заменить `API_BASE_URL` на `https://api.radegust.ru`.

## 6. Что нужно от вас, чтобы заработала оплата и уведомления

- Реквизиты магазина ЮKassa (`shop_id` + `secret_key`) — из личного кабинета ЮKassa.
- Telegram Bot Token (создаётся за 1 минуту через @BotFather) + ваш chat_id.
- Сам VPS (после установки — впишем реальный IP/домен в конфиги).

## 7. Что уже сделано в этом коммите

- Backend полностью реализован (`server/`), готов к запуску локально или на VPS.
- Лендинг подключён к API: форма реально отправляется, добавлен календарь занятости.
- Без реальных секретов ЮKassa/Telegram backend работает в режиме "заявка сохраняется, оплата по ссылке не создаётся" — не падает, но не подключён к реальным деньгам, пока вы не впишете ключи в `.env`.
