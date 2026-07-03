# apart-server

Backend для бронирования Tvoy Apart 24/7. Node.js + Express + SQLite.

## Запуск локально

```bash
cd server
npm install
cp .env.example .env   # заполнить реальными ключами по необходимости
npm start
```

Без заполненных `YOOKASSA_*`/`TELEGRAM_*` сервер работает: заявки сохраняются,
оплата по ссылке не создаётся (просто `confirmationUrl: null`), уведомления
пишутся в консоль вместо Telegram.

## Развёртывание на VPS

1. Node.js 20+, `npm install --production`.
2. Заполнить `.env` реальными ключами ЮKassa и Telegram.
3. Запускать как systemd-сервис или через `pm2 start src/index.js --name apart-server`.
4. nginx: проксировать поддомен (например `api.radegust.ru`) на `localhost:3000`, HTTPS через certbot.
5. В `index.html` заменить `window.APART_API_BASE_URL` на реальный адрес API (или задать глобальную переменную перед подключением скрипта).
6. В ЮKassa указать webhook URL: `https://api.radegust.ru/api/webhooks/yookassa` (событие `payment.succeeded`).

## Ручное подтверждение оплаты по реквизитам

Оплата картой/по ссылке подтверждается автоматически через вебхук ЮKassa.
Оплата переводом по реквизитам подтверждается вручную менеджером:

```bash
curl -X POST -u admin:PASSWORD https://api.radegust.ru/api/admin/bookings/<id>/confirm
```
