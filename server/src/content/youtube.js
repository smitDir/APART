const fs = require('fs');
const { google } = require('googleapis');

function isConfigured() {
  return Boolean(
    process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN
  );
}

function getAuthClient() {
  const oauth2Client = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  return oauth2Client;
}

// caption хранит и заголовок, и описание вместе: первая строка — заголовок
// (обрезается до лимита YouTube в 100 символов), остальное — описание.
function splitTitleDescription(caption) {
  const lines = (caption || '').split('\n');
  const title = (lines[0] || 'Tvoy Apart 24/7').slice(0, 100);
  const description = lines.slice(1).join('\n').trim();
  return { title, description };
}

async function uploadVideo(post) {
  const youtube = google.youtube({ version: 'v3', auth: getAuthClient() });
  const { title, description } = splitTitleDescription(post.caption);

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: '22', // People & Blogs — ближайшая общая категория
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(post.media_path),
    },
  });

  return res.data; // res.data.id — id видео, ссылка https://youtu.be/<id>
}

module.exports = { isConfigured, uploadVideo };
