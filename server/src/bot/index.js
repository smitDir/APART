const { TelegramBot } = require('node-telegram-bot-api');
const db = require('../db');
const session = require('./session');
const { createBooking, addBookingItems, BookingError } = require('../services/bookingService');
const { calculatePricing } = require('../services/pricing');
const {
  getContent,
  getMenuItems,
  getMenuCategories,
  MANAGER_CONTACT,
  CATEGORY_LABELS,
} = require('./content');
const gemini = require('../ai/gemini');
const { buildSystemPrompt } = require('../ai/knowledgeBase');
const conversation = require('../ai/conversation');
const whisper = require('../ai/whisper');

const PROPERTY_ID = 1; // основной путь — студия
const BUDGET_PROPERTY_ID = 2; // предлагается, если гость просит подешевле
const CONSENT_TEXT =
  'Для оформления брони подтвердите согласие на обработку персональных данных, ' +
  'условия договора аренды и правила проживания. Нажимая «Согласен», вы принимаете все три документа.';
const CONSENT_DOCS = ['pd_processing', 'rental_agreement', 'house_rules'];

// Гость вводит дату в привычном ДД.ММ.ГГГГ, а не ISO — конвертируем и заодно
// отсеиваем несуществующие даты вроде 31.02, которые Date иначе тихо перекатит
// на март.
function parseRuDate(text) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(`${iso}T00:00:00Z`);
  const valid =
    d.getUTCFullYear() === Number(yyyy) && d.getUTCMonth() + 1 === Number(mm) && d.getUTCDate() === Number(dd);
  return valid ? iso : null;
}

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📅 Забронировать', callback_data: 'main:book' }],
      [{ text: '🍳 Меню питания/трансфер', callback_data: 'main:menu' }],
      [{ text: '📖 Инструкции по квартире', callback_data: 'main:manual' }],
      [{ text: '🚑 Экстренные службы', callback_data: 'main:emergency' }],
      [{ text: '🎭 Мероприятия рядом', callback_data: 'main:events' }],
      [{ text: '👤 Менеджер', callback_data: 'main:manager' }],
    ],
  };
}

function sendMainMenu(bot, chatId) {
  session.clear(chatId);
  bot.sendMessage(chatId, 'Добро пожаловать в Tvoy Apart 24/7! Выберите действие:', {
    reply_markup: mainMenuKeyboard(),
  });
}

// Гость выбрал на сайте «уведомлять в Telegram» — Bot API не может написать
// первым по свободно введённому @handle (нужен chat_id, который появляется
// только когда сам гость напишет боту), поэтому сайт даёт ссылку-диплинк
// вида t.me/bot?start=b<id>, и подтверждение приходит именно здесь, по факту перехода.
async function confirmTelegramChannel(bot, msg, bookingId) {
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) {
    return bot.sendMessage(msg.chat.id, 'Не нашли такую заявку. Если это ошибка — напишите менеджеру /manager.');
  }
  const handle = msg.from.username ? '@' + msg.from.username : `chat:${msg.chat.id}`;
  await db.run('UPDATE bookings SET telegram = ? WHERE id = ?', [handle, bookingId]);
  bot.sendMessage(
    msg.chat.id,
    `Заявка №${bookingId} принята и обрабатывается.\n${booking.full_name}, ${booking.check_in} → ${booking.check_out}.\n` +
      'Будем присылать уведомления сюда, в Telegram.'
  );
}

function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[bot] TELEGRAM_BOT_TOKEN not set, bot not started');
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/^\/start(?:\s+(\S+))?$/, (msg, match) => {
    const payload = match[1];
    const bookingId = payload && /^b\d+$/.test(payload) ? Number(payload.slice(1)) : null;
    if (bookingId) return confirmTelegramChannel(bot, msg, bookingId);
    sendMainMenu(bot, msg.chat.id);
  });
  bot.onText(/^\/menu_main$/, (msg) => sendMainMenu(bot, msg.chat.id));

  bot.onText(/\/book/, (msg) => beginBooking(bot, msg.chat.id, PROPERTY_ID));
  bot.onText(/\/manual/, async (msg) => bot.sendMessage(msg.chat.id, await getContent(PROPERTY_ID, 'manual')));
  bot.onText(/\/emergency/, async (msg) =>
    bot.sendMessage(msg.chat.id, await getContent(PROPERTY_ID, 'emergency'))
  );
  bot.onText(/\/events/, async (msg) => bot.sendMessage(msg.chat.id, await getContent(PROPERTY_ID, 'events')));
  bot.onText(/\/manager/, (msg) => bot.sendMessage(msg.chat.id, MANAGER_CONTACT));
  bot.onText(/\/cancel/, (msg) => {
    session.clear(msg.chat.id);
    bot.sendMessage(msg.chat.id, 'Бронирование отменено.');
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    await bot.answerCallbackQuery(query.id);

    if (data === 'main:book') return beginBooking(bot, chatId, PROPERTY_ID);
    if (data === 'book_room') return beginBooking(bot, chatId, BUDGET_PROPERTY_ID);
    if (data === 'main:menu') return showMenuBrowse(bot, chatId);
    if (data === 'main:manual') return bot.sendMessage(chatId, await getContent(PROPERTY_ID, 'manual'));
    if (data === 'main:emergency') return bot.sendMessage(chatId, await getContent(PROPERTY_ID, 'emergency'));
    if (data === 'main:events') return bot.sendMessage(chatId, await getContent(PROPERTY_ID, 'events'));
    if (data === 'main:manager') return bot.sendMessage(chatId, MANAGER_CONTACT);

    const s = session.get(chatId);
    if (!s) return;

    if (data.startsWith('menu_cat:')) return showMenuItems(bot, chatId, s, data.slice('menu_cat:'.length));
    if (data.startsWith('menu_item:')) return addMenuItem(bot, chatId, s, Number(data.slice('menu_item:'.length)));
    if (data === 'menu_done') return goToPayment(bot, chatId, s);
    if (data.startsWith('guests:')) return handleGuests(bot, chatId, s, data.slice('guests:'.length));
    if (data.startsWith('payment:')) return handlePayment(bot, chatId, s, data.slice('payment:'.length));
    if (data === 'consent_accept') return finalizeBooking(bot, chatId, s, query.from);
  });

  bot.on('message', (msg) => {
    // Временный диагностический лог — помогает узнать chat_id новой группы
    // менеджера для TELEGRAM_MANAGER_CHANNEL_ID. Убрать после настройки.
    if (msg.chat.type !== 'private') {
      console.log(`[bot] group message: chat_id=${msg.chat.id} type=${msg.chat.type} title="${msg.chat.title}"`);
    }
    if (msg.voice) return handleVoiceMessage(bot, msg);
    if (!msg.text || msg.text.startsWith('/')) return;
    const s = session.get(msg.chat.id);
    if (s) return handleTextStep(bot, msg, s);
    handleFreeformMessage(bot, msg);
  });

  console.log('[bot] started (polling)');
  return bot;
}

// Голосовое сообщение: скачиваем аудио с серверов Telegram, расшифровываем
// через Whisper и дальше обрабатываем расшифрованный текст точно так же,
// как обычное текстовое сообщение (шаг сценария брони или свободный AI-диалог).
async function handleVoiceMessage(bot, msg) {
  const chatId = msg.chat.id;
  if (!whisper.isConfigured()) {
    return bot.sendMessage(chatId, 'Голосовые сообщения пока не поддерживаются — напишите текстом.');
  }

  try {
    const fileLink = await bot.getFileLink(msg.voice.file_id);
    const audioRes = await fetch(fileLink);
    const buffer = Buffer.from(await audioRes.arrayBuffer());
    const text = await whisper.transcribe(buffer);

    if (!text || !text.trim()) {
      return bot.sendMessage(chatId, 'Не удалось распознать голосовое сообщение. Попробуйте написать текстом.');
    }

    await bot.sendMessage(chatId, `🎙 Расшифровка: «${text}»`);

    const textMsg = { ...msg, text };
    const s = session.get(chatId);
    if (s) return handleTextStep(bot, textMsg, s);
    return handleFreeformMessage(bot, textMsg);
  } catch (err) {
    console.error('[bot] voice transcription failed', err);
    bot.sendMessage(chatId, 'Не получилось распознать голосовое. Попробуйте написать текстом или /manager.');
  }
}

async function handleFreeformMessage(bot, msg) {
  const chatId = msg.chat.id;
  if (!gemini.isConfigured()) {
    return bot.sendMessage(
      chatId,
      'Я пока не умею отвечать на свободные вопросы — воспользуйтесь командами /book, /menu, /manual, /emergency, /events или /manager.'
    );
  }

  await conversation.appendMessage(chatId, 'user', msg.text);
  const history = await conversation.getHistory(chatId);

  try {
    const reply = await gemini.generateReply(await buildSystemPrompt(PROPERTY_ID), history);
    await conversation.appendMessage(chatId, 'model', reply);
    bot.sendMessage(chatId, reply, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Бюджетный вариант (комната)', callback_data: 'book_room' }],
          [{ text: '👤 Написать менеджеру', callback_data: 'main:manager' }],
        ],
      },
    });
  } catch (err) {
    console.error('[bot] AI reply failed', err);
    bot.sendMessage(chatId, 'Не получилось ответить. Попробуйте /manager, чтобы связаться с менеджером напрямую.');
  }
}

function beginBooking(bot, chatId, propertyId) {
  session.start(chatId, { step: 'full_name', data: { propertyId, extras: [] } });
  bot.sendMessage(chatId, 'Оформим бронь. Как вас зовут (имя и фамилия)?');
}

async function showMenuBrowse(bot, chatId) {
  const categories = await getMenuCategories(PROPERTY_ID);
  if (categories.length === 0) {
    return bot.sendMessage(chatId, 'Меню пока не заполнено.');
  }
  bot.sendMessage(chatId, 'Выберите категорию:', {
    reply_markup: {
      inline_keyboard: categories.map((c) => [
        { text: CATEGORY_LABELS[c] || c, callback_data: 'menu_cat:' + c },
      ]),
    },
  });
}

function handleTextStep(bot, msg, s) {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  switch (s.step) {
    case 'full_name':
      s.data.fullName = text;
      s.step = 'phone';
      bot.sendMessage(chatId, 'Ваш телефон?', {
        reply_markup: {
          keyboard: [[{ text: 'Отправить номер телефона', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
      break;

    case 'phone':
      s.data.phone = msg.contact ? msg.contact.phone_number : text;
      s.step = 'email';
      bot.sendMessage(chatId, 'Ваш email?', { reply_markup: { remove_keyboard: true } });
      break;

    case 'email':
      s.data.email = text;
      s.step = 'check_in';
      bot.sendMessage(chatId, 'Дата заезда? (в формате ДД.ММ.ГГГГ, например 01.08.2026)');
      break;

    case 'check_in': {
      const iso = parseRuDate(text);
      if (!iso) {
        return bot.sendMessage(chatId, 'Формат даты: ДД.ММ.ГГГГ, например 01.08.2026. Попробуйте ещё раз.');
      }
      s.data.checkIn = iso;
      s.step = 'check_out';
      bot.sendMessage(chatId, 'Дата выезда? (ДД.ММ.ГГГГ)');
      break;
    }

    case 'check_out': {
      const iso = parseRuDate(text);
      if (!iso || iso <= s.data.checkIn) {
        return bot.sendMessage(chatId, 'Дата выезда должна быть позже даты заезда, формат ДД.ММ.ГГГГ.');
      }
      s.data.checkOut = iso;
      s.step = 'guests';
      bot.sendMessage(chatId, 'Сколько гостей?', {
        reply_markup: {
          inline_keyboard: [[
            { text: '1', callback_data: 'guests:1' },
            { text: '2', callback_data: 'guests:2' },
            { text: '3', callback_data: 'guests:3' },
          ]],
        },
      });
      break;
    }

    default:
      break;
  }
}

async function handleGuests(bot, chatId, s, guests) {
  s.data.guests = Number(guests);
  s.step = 'menu';
  const categories = await getMenuCategories(s.data.propertyId);
  bot.sendMessage(chatId, 'Хотите добавить доп. услуги (завтрак/обед/трансфер)?', {
    reply_markup: {
      inline_keyboard: [
        ...categories.map((c) => [{ text: CATEGORY_LABELS[c] || c, callback_data: 'menu_cat:' + c }]),
        [{ text: 'Пропустить →', callback_data: 'menu_done' }],
      ],
    },
  });
}

async function showMenuItems(bot, chatId, s, category) {
  const items = await getMenuItems(s.data.propertyId, category);
  if (items.length === 0) {
    return bot.sendMessage(chatId, 'В этой категории пока нет позиций.');
  }
  bot.sendMessage(chatId, `${CATEGORY_LABELS[category] || category}:`, {
    reply_markup: {
      inline_keyboard: [
        ...items.map((item) => [
          { text: `${item.name} — ${item.price}₽`, callback_data: 'menu_item:' + item.id },
        ]),
        [{ text: 'Готово →', callback_data: 'menu_done' }],
      ],
    },
  });
}

function addMenuItem(bot, chatId, s, menuItemId) {
  s.data.extras.push({ menuItemId, quantity: 1 });
  bot.sendMessage(chatId, 'Добавлено. Можно выбрать ещё или нажать «Готово».');
}

async function goToPayment(bot, chatId, s) {
  s.step = 'payment';

  const pricing = await calculatePricing(s.data.propertyId, s.data.checkIn, s.data.checkOut);
  const priceText = pricing.individual
    ? `${pricing.nights} ноч. — это долгосрочное проживание, точную цену и условия обсудим лично, менеджер свяжется с вами.`
    : `${pricing.nights} ноч. × ${pricing.pricePerNight}₽${pricing.tierLabel ? ` (${pricing.tierLabel})` : ''} = ${pricing.totalAmount}₽\n` +
      `Для подтверждения брони — аванс ${pricing.advanceAmount}₽ (${pricing.depositPercent}%), остальное при заезде.` +
      (pricing.securityDeposit ? `\nЗалог: ${pricing.securityDeposit}₽ (возврат после выезда).` : '');
  bot.sendMessage(chatId, priceText);

  bot.sendMessage(chatId, 'Способ оплаты?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Банковская карта', callback_data: 'payment:card' }],
        [{ text: 'Перевод по реквизитам', callback_data: 'payment:transfer' }],
        [{ text: 'Оплата по ссылке (онлайн)', callback_data: 'payment:link' }],
      ],
    },
  });
}

function handlePayment(bot, chatId, s, method) {
  s.data.payment = method;
  s.step = 'consent';
  bot.sendMessage(chatId, CONSENT_TEXT, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📄 Условия аренды и правила проживания', url: 'https://apart247.ru/rental-terms' }],
        [{ text: '🔒 Политика конфиденциальности', url: 'https://apart247.ru/guest-privacy' }],
        [{ text: '✅ Согласен', callback_data: 'consent_accept' }],
      ],
    },
  });
}

async function finalizeBooking(bot, chatId, s, from) {
  try {
    // Гость и так пишет из Telegram — берём хендл из самого API, а не
    // переспрашиваем то, что уже известно из апдейта.
    const telegramHandle = from.username ? '@' + from.username : null;
    const result = await createBooking({
      propertyId: s.data.propertyId,
      channel: 'telegram_bot',
      fullName: s.data.fullName,
      phone: s.data.phone,
      email: s.data.email,
      telegram: telegramHandle,
      checkIn: s.data.checkIn,
      checkOut: s.data.checkOut,
      guests: s.data.guests,
      payment: s.data.payment,
      consent: true,
    });

    if (s.data.extras.length > 0) {
      await addBookingItems(result.bookingId, s.data.extras);
    }

    for (const docType of CONSENT_DOCS) {
      await db.run(
        'INSERT INTO consents (booking_id, telegram_user_id, document_type, document_version) VALUES (?, ?, ?, ?)',
        [result.bookingId, String(from.id), docType, 'v1']
      );
    }

    session.clear(chatId);

    if (result.confirmationUrl) {
      bot.sendMessage(chatId, `Бронь №${result.bookingId} создана. Для подтверждения оплатите по ссылке:`, {
        reply_markup: { inline_keyboard: [[{ text: 'Оплатить', url: result.confirmationUrl }]] },
      });
    } else {
      bot.sendMessage(
        chatId,
        `Заявка №${result.bookingId} принята! Менеджер свяжется с вами для подтверждения.`
      );
    }
  } catch (err) {
    if (err instanceof BookingError && err.code === 'conflict') {
      bot.sendMessage(chatId, 'Эти даты уже заняты. Начните заново командой /book и выберите другие даты.');
    } else {
      console.error('[bot] booking finalize failed', err);
      bot.sendMessage(chatId, 'Не удалось оформить бронь. Попробуйте позже или свяжитесь с менеджером /manager.');
    }
    session.clear(chatId);
  }
}

module.exports = { startBot };
