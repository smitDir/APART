// In-memory per-chat conversation state. A restart mid-booking loses the
// draft, but no booking data is written until the flow completes, so
// nothing inconsistent ends up in the database.
const sessions = new Map();

function get(chatId) {
  return sessions.get(chatId);
}

function start(chatId, initial) {
  sessions.set(chatId, initial);
  return sessions.get(chatId);
}

function clear(chatId) {
  sessions.delete(chatId);
}

module.exports = { get, start, clear };
