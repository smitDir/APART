#!/usr/bin/env bash
# Деплой/обновление apart-server на уже провизионированном VPS (после provision.sh).
# Запускать от пользователя с доступом к git и npm (root или deploy).
#
# Использование:
#   REPO_URL=https://github.com/<org>/APART.git bash deploy_apart.sh
# Переменная REPO_URL обязательна при первом запуске (клонирование);
# при повторных запусках скрипт просто обновляет существующую копию (git pull).

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/apart-server}"
REPO_URL="${REPO_URL:-}"

if [ ! -d "${APP_DIR}/.git" ]; then
  if [ -z "${REPO_URL}" ]; then
    echo "Репозиторий ещё не склонирован — задайте REPO_URL=... bash deploy_apart.sh" >&2
    exit 1
  fi
  echo "==> Клонирование репозитория в ${APP_DIR}"
  git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "==> Обновление существующей копии в ${APP_DIR}"
  git -C "${APP_DIR}" pull --ff-only
fi

cd "${APP_DIR}/server"

echo "==> Установка зависимостей"
npm install --omit=dev

if [ ! -f .env ]; then
  echo "==> .env не найден — копирую .env.example, ЗАПОЛНИТЕ реальными значениями вручную"
  cp .env.example .env
  echo "    nano ${APP_DIR}/server/.env"
fi

echo "==> Запуск/перезапуск через pm2"
pm2 start src/index.js --name apart-server --update-env || pm2 restart apart-server --update-env
pm2 save

echo ""
echo "=================================================================="
echo "apart-server запущен под pm2. Проверить: pm2 status, pm2 logs apart-server"
echo "Автозапуск pm2 при перезагрузке сервера (один раз): pm2 startup"
echo "Контент-крон (публикация постов) — добавить в crontab (crontab -e):"
echo "  */5 * * * * cd ${APP_DIR}/server && node src/content/run.js >> /var/log/apart-content.log 2>&1"
echo "=================================================================="
