const db = require('../db');

// Один пакет = предложение постов на неделю (несколько scheduled_posts с общим
// week_of), которое утверждается сразу целиком, а не по одному посту.
function createWeeklyProposal(weekOf, theme, posts) {
  const insert = db.prepare(
    `INSERT INTO scheduled_posts (channel, content_type, theme, week_of, caption, media_prompt, scheduled_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`
  );
  const tx = db.transaction((rows) => {
    for (const p of rows) {
      insert.run(
        p.channel || 'telegram',
        p.contentType || 'photo',
        theme,
        weekOf,
        p.caption,
        p.mediaPrompt || null,
        p.scheduledAt || null
      );
    }
  });
  tx(posts);
}

function getWeeklyProposal(weekOf) {
  return db.prepare('SELECT * FROM scheduled_posts WHERE week_of = ? ORDER BY scheduled_at').all(weekOf);
}

function approveWeeklyProposal(weekOf) {
  const info = db
    .prepare("UPDATE scheduled_posts SET status = 'approved' WHERE week_of = ? AND status = 'draft'")
    .run(weekOf);
  return info.changes;
}

function setMonthTheme(month, theme, notes) {
  db.prepare('INSERT INTO content_themes (month, theme, notes) VALUES (?, ?, ?)').run(month, theme, notes || null);
}

function getMonthTheme(month) {
  return db
    .prepare('SELECT * FROM content_themes WHERE month = ? ORDER BY created_at DESC LIMIT 1')
    .get(month);
}

module.exports = { createWeeklyProposal, getWeeklyProposal, approveWeeklyProposal, setMonthTheme, getMonthTheme };
