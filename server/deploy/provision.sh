#!/usr/bin/env bash
# Провизионирование VPS для apart-server (и в целом для проектов Tvoy Apart 24/7).
# Запускать от root на чистом Ubuntu 24.04/26.04 LTS: bash provision.sh
#
# Что делает:
#   1. Обновляет систему, ставит базовые утилиты.
#   2. Настраивает firewall (ufw) и fail2ban.
#   3. Ставит Node.js 20 LTS.
#   4. Ставит MySQL (MariaDB) и создаёт базу+пользователя для apart (своя база
#      на каждый проект — см. server/README.md).
#   5. Ставит nginx + certbot.
#   6. Ставит pm2 (менеджер процессов Node).
#   7. Создаёт непривилегированного пользователя deploy для запуска приложений
#      (не под root).
#
# После этого скрипта — деплой самого apart-server делается отдельно
# (см. deploy_apart.sh в этой же папке), когда репозиторий склонирован на сервер.

set -euo pipefail

DB_NAME="${DB_NAME:-apart}"
DB_USER="${DB_USER:-apart}"
DB_PASSWORD="${DB_PASSWORD:?Задайте DB_PASSWORD перед запуском: DB_PASSWORD=... bash provision.sh}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

echo "==> Обновление системы"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> Базовые утилиты"
apt-get install -y curl wget git ufw fail2ban unzip ca-certificates gnupg

echo "==> Firewall (ufw): разрешаем SSH/HTTP/HTTPS, остальное закрыто"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> fail2ban (защита SSH от перебора паролей)"
systemctl enable --now fail2ban

echo "==> Node.js 20 LTS"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> pm2 (менеджер процессов Node)"
npm install -g pm2

echo "==> MySQL (MariaDB)"
apt-get install -y mariadb-server mariadb-client
systemctl enable --now mariadb

mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "    База '${DB_NAME}' и пользователь '${DB_USER}' готовы."
echo "    Для следующего проекта: DB_NAME=lamps DB_PASSWORD=... bash provision.sh"
echo "    (шаги 1-6 идемпотентны, безопасно перезапускать с другим DB_NAME/DB_USER)"

echo "==> nginx + certbot"
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx

echo "==> Пользователь для запуска приложений (не root): ${DEPLOY_USER}"
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
  usermod -aG sudo "${DEPLOY_USER}"
fi

echo ""
echo "=================================================================="
echo "Готово. Дальше:"
echo "1. Скопировать SSH-ключ пользователю ${DEPLOY_USER} (или продолжать под root, если удобнее)."
echo "2. Склонировать репозиторий и запустить deploy_apart.sh (см. эту же папку)."
echo "3. Настроить nginx-конфиг под api.<ваш-домен> (шаблон — nginx-apart.conf)."
echo "4. certbot --nginx -d api.<ваш-домен>  — получить HTTPS-сертификат."
echo "=================================================================="
