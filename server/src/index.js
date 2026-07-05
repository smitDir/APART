require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const db = require('./db');
const propertiesRouter = require('./routes/properties');
const bookingsRouter = require('./routes/bookings');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');
const { router: adminPanelRouter } = require('./routes/adminPanel');
const { startBot } = require('./bot');

const app = express();
// nginx проксирует по HTTP, но реальный клиент приходит по HTTPS — без этого
// express-session не выставит secure-cookie (см. cookie.secure: 'auto' ниже).
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: 'auto', sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 },
  })
);

app.use('/api/properties', propertiesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/admin', adminRouter);
app.use('/admin', adminPanelRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Публичные страницы для верификации Google OAuth (App homepage / Privacy Policy).
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'about.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'privacy.html')));

// Публичные страницы для гостей (ссылки из формы брони на лендинге и из бота).
app.get('/guest-privacy', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'guest-privacy.html')));
app.get('/rental-terms', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'rental-terms.html')));

// Лендинг (корень репозитория, на одном домене с API — apart247.ru).
const REPO_ROOT = path.join(__dirname, '..', '..');
app.use('/image', express.static(path.join(REPO_ROOT, 'image')));
app.get('/', (req, res) => res.sendFile(path.join(REPO_ROOT, 'index.html')));

const port = process.env.PORT || 3000;

db.ready
  .then(() => {
    app.listen(port, () => console.log(`apart-server listening on :${port}`));
    startBot();
  })
  .catch((err) => {
    console.error('[index] database init failed', err);
    process.exit(1);
  });
