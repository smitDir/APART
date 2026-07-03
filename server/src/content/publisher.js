const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');

function isVideo(mediaPath) {
  return /\.(mp4|mov|mkv)$/i.test(mediaPath);
}

// Карусель: несколько фото/видео в одном сообщении (свайпается в Telegram),
// media_path хранит JSON-массив путей вместо одного пути.
async function publishCarousel(bot, channelId, post) {
  const paths = JSON.parse(post.media_path);
  for (const p of paths) {
    if (!fs.existsSync(p)) throw new Error(`carousel file missing: ${p}`);
  }
  const media = paths.map((p, i) => ({
    type: isVideo(p) ? 'video' : 'photo',
    media: p,
    // Telegram показывает подпись группы только у первого элемента.
    ...(i === 0 && post.caption ? { caption: post.caption } : {}),
  }));
  await bot.sendMediaGroup(channelId, media);
}

async function publishDuePosts() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channelId) {
    console.log('[content] TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL_ID not set, skipping publish run');
    return;
  }

  const bot = new TelegramBot(token, { polling: false });
  const due = db
    .prepare(
      `SELECT * FROM scheduled_posts
       WHERE channel = 'telegram' AND status = 'generated'
       AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))`
    )
    .all();

  for (const post of due) {
    try {
      if (!post.media_path) {
        console.error(`[content] post #${post.id} has no media_path, skipping`);
        continue;
      }
      if (post.content_type === 'carousel') {
        await publishCarousel(bot, channelId, post);
      } else if (!fs.existsSync(post.media_path)) {
        console.error(`[content] post #${post.id} has no valid media_path, skipping`);
        continue;
      } else if (isVideo(post.media_path)) {
        await bot.sendVideo(channelId, post.media_path, { caption: post.caption || '' });
      } else {
        await bot.sendPhoto(channelId, post.media_path, { caption: post.caption || '' });
      }
      db.prepare("UPDATE scheduled_posts SET status = 'posted', posted_at = datetime('now') WHERE id = ?").run(
        post.id
      );
      console.log(`[content] posted #${post.id} to Telegram channel`);
    } catch (err) {
      console.error(`[content] failed to post #${post.id}`, err);
      db.prepare("UPDATE scheduled_posts SET status = 'failed' WHERE id = ?").run(post.id);
    }
  }
}

module.exports = { publishDuePosts };
