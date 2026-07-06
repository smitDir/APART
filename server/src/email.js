const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      // Без этого зависший/заблокированный SMTP-порт может держать запрос
      // бронирования десятки секунд, пока клиент (или nginx) не оборвёт
      // соединение — короткий таймаут превращает это в быстрый неуспех.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
      // У хостера SMTP_HOST — это CNAME на общий почтовый кластер, чей
      // сертификат выписан не на SMTP_HOST, а на их собственный домен
      // (shared-хостинг не делает серт под каждый клиентский поддомен).
      // servername переопределяет имя, по которому проверяется сертификат,
      // не отключая саму проверку.
      tls: process.env.SMTP_TLS_SERVERNAME ? { servername: process.env.SMTP_TLS_SERVERNAME } : undefined,
    });
  }
  return transporter;
}

// Возвращает true/false — вызывающий код (bookingService) должен знать,
// дошло ли письмо, чтобы не молчать об этом перед гостем/менеджером.
async function sendEmail(to, subject, text) {
  if (!isConfigured()) {
    console.log(`[email] SMTP not configured, skipping send to ${to}: ${subject}\n${text}`);
    return false;
  }
  try {
    await getTransporter().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
    return true;
  } catch (err) {
    console.error('[email] send failed', err);
    return false;
  }
}

module.exports = { isConfigured, sendEmail };
