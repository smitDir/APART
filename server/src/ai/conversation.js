const db = require('../db');

const HISTORY_LIMIT = 20;

function appendMessage(chatId, role, content) {
  db.prepare('INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)').run(
    String(chatId),
    role,
    content
  );
}

function getHistory(chatId) {
  const rows = db
    .prepare(
      `SELECT role, content FROM chat_messages WHERE chat_id = ?
       ORDER BY id DESC LIMIT ?`
    )
    .all(String(chatId), HISTORY_LIMIT);
  return rows.reverse();
}

module.exports = { appendMessage, getHistory };
