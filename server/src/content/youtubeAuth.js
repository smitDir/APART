// Одноразовый скрипт для получения YOUTUBE_REFRESH_TOKEN.
//
// Запускать НА СВОЁМ КОМПЬЮТЕРЕ (не на headless VPS — нужен браузер на этой
// же машине, скрипт поднимает временный локальный сервер для приёма
// редиректа OAuth). Полученный refresh_token — переносимый, его можно
// потом просто скопировать в .env на сервере.
//
// Предварительно: в server/.env должны быть заполнены YOUTUBE_CLIENT_ID и
// YOUTUBE_CLIENT_SECRET (Google Cloud Console → OAuth client ID, тип
// "Desktop app" — этот тип разрешает редирект на http://127.0.0.1:<порт>
// без предварительной регистрации точного порта).
//
// Запуск: node src/content/youtubeAuth.js

require('dotenv').config();
const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

function main() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Задайте YOUTUBE_CLIENT_ID и YOUTUBE_CLIENT_SECRET в .env перед запуском.');
    process.exit(1);
  }

  const server = http.createServer();
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const redirectUri = `http://127.0.0.1:${port}`;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });

    console.log('Откройте эту ссылку в браузере на этом же компьютере и войдите под аккаунтом канала:\n');
    console.log(authUrl);
    console.log('\nОжидаю авторизацию...');

    server.on('request', async (req, res) => {
      const query = new URL(req.url, redirectUri).searchParams;
      const code = query.get('code');
      const error = query.get('error');

      if (error) {
        res.end('Авторизация отклонена. Смотрите терминал.');
        server.close();
        console.error('OAuth error:', error);
        process.exit(1);
      }
      if (!code) {
        res.end('Ожидаю код авторизации...');
        return;
      }

      res.end('Готово! Можно закрыть эту вкладку и вернуться в терминал.');
      server.close();
      try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('\nГотово. Сохраните это значение в .env как YOUTUBE_REFRESH_TOKEN:\n');
        console.log(tokens.refresh_token);
      } catch (err) {
        console.error('Не удалось обменять код на токен:', err.message);
        process.exit(1);
      }
    });
  });
}

main();
