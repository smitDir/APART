const db = require('../db');

// Один пакет = предложение постов на неделю (несколько scheduled_posts с общим
// week_of), которое утверждается сразу целиком, а не по одному посту.
async function createWeeklyProposal(weekOf, theme, posts) {
  await db.transaction(async (tx) => {
    for (const p of posts) {
      await tx.run(
        `INSERT INTO scheduled_posts (channel, content_type, theme, week_of, caption, media_prompt, scheduled_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`,
        [
          p.channel || 'telegram',
          p.contentType || 'photo',
          theme,
          weekOf,
          p.caption,
          p.mediaPrompt || null,
          p.scheduledAt || null,
        ]
      );
    }
  });
}

async function getWeeklyProposal(weekOf) {
  return db.all('SELECT * FROM scheduled_posts WHERE week_of = ? ORDER BY scheduled_at', [weekOf]);
}

async function approveWeeklyProposal(weekOf) {
  const info = await db.run(
    "UPDATE scheduled_posts SET status = 'approved' WHERE week_of = ? AND status = 'draft'",
    [weekOf]
  );
  return info.changes;
}

async function setMonthTheme(month, theme, notes) {
  await db.run('INSERT INTO content_themes (month, theme, notes) VALUES (?, ?, ?)', [month, theme, notes || null]);
}

async function getMonthTheme(month) {
  return db.get('SELECT * FROM content_themes WHERE month = ? ORDER BY created_at DESC LIMIT 1', [month]);
}

module.exports = { createWeeklyProposal, getWeeklyProposal, approveWeeklyProposal, setMonthTheme, getMonthTheme };
