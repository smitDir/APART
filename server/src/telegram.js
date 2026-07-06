const fetch = require('node-fetch');

async function sendToChat(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      console.error('[telegram] send failed', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[telegram] send failed', err);
    return false;
  }
}

async function notifyTelegram(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.log('[telegram] TELEGRAM_CHAT_ID not set, skipping notification:\n' + text);
    return;
  }
  await sendToChat(chatId, text);
}

// Отдельный групповой чат/канал менеджера — chat_id, не инвайт-ссылка
// (t.me/+... не резолвится Bot API в chat_id, нужен реальный числовой ID:
// добавить бота в группу админом и один раз посмотреть chat_id входящего апдейта).
async function notifyManagerChannel(text) {
  const chatId = process.env.TELEGRAM_MANAGER_CHANNEL_ID;
  if (!chatId) {
    console.log('[telegram] TELEGRAM_MANAGER_CHANNEL_ID not set, skipping channel notification:\n' + text);
    return;
  }
  await sendToChat(chatId, text);
}

module.exports = { notifyTelegram, notifyManagerChannel, sendToChat };
