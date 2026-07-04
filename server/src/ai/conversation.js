const db = require('../db');

const HISTORY_LIMIT = 20;

async function appendMessage(chatId, role, content) {
  await db.run('INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)', [
    String(chatId),
    role,
    content,
  ]);
}

async function getHistory(chatId) {
  const rows = await db.all(
    `SELECT role, content FROM chat_messages WHERE chat_id = ?
     ORDER BY id DESC LIMIT ?`,
    [String(chatId), HISTORY_LIMIT]
  );
  return rows.reverse();
}

module.exports = { appendMessage, getHistory };
