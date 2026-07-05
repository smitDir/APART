const fs = require('fs');
const { TelegramBot } = require('node-telegram-bot-api');
const db = require('../db');
const youtube = require('./youtube');

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

async function publishTelegramDue() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channelId) {
    console.log('[content] TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL_ID not set, skipping Telegram publish run');
    return;
  }

  const bot = new TelegramBot(token, { polling: false });
  const due = await db.all(
    `SELECT * FROM scheduled_posts
     WHERE channel = 'telegram' AND status = 'generated'
     AND (scheduled_at IS NULL OR scheduled_at <= NOW())`
  );

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
      await db.run("UPDATE scheduled_posts SET status = 'posted', posted_at = NOW() WHERE id = ?", [post.id]);
      console.log(`[content] posted #${post.id} to Telegram channel`);
    } catch (err) {
      console.error(`[content] failed to post #${post.id}`, err);
      await db.run("UPDATE scheduled_posts SET status = 'failed' WHERE id = ?", [post.id]);
    }
  }
}

async function publishYoutubeDue() {
  if (!youtube.isConfigured()) {
    console.log('[content] YOUTUBE_* env not set, skipping YouTube publish run');
    return;
  }

  const due = await db.all(
    `SELECT * FROM scheduled_posts
     WHERE channel = 'youtube' AND status = 'generated'
     AND (scheduled_at IS NULL OR scheduled_at <= NOW())`
  );

  for (const post of due) {
    try {
      if (!post.media_path || !fs.existsSync(post.media_path)) {
        console.error(`[content] post #${post.id} has no valid media_path, skipping`);
        continue;
      }
      const result = await youtube.uploadVideo(post);
      await db.run("UPDATE scheduled_posts SET status = 'posted', posted_at = NOW() WHERE id = ?", [post.id]);
      console.log(`[content] posted #${post.id} to YouTube: https://youtu.be/${result.id}`);
    } catch (err) {
      console.error(`[content] failed to post #${post.id} to YouTube`, err);
      await db.run("UPDATE scheduled_posts SET status = 'failed' WHERE id = ?", [post.id]);
    }
  }
}

async function publishDuePosts() {
  await publishTelegramDue();
  await publishYoutubeDue();
}

module.exports = { publishDuePosts };
