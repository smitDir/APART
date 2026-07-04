# Провизионирование и деплой VPS

Скрипты для первоначальной настройки VPS и деплоя `apart-server`. Написаны так,
чтобы их запускал сам пользователь на сервере (см. TZ.md — из этой облачной
сессии нет прямого SSH-доступа к произвольным серверам, только HTTPS/443,
раз-TCP на порт 22 сетевой политикой окружения заблокирован).

## Порядок действий на сервере

```bash
# 1. Провизионирование системы (один раз на сервер; повторно — под новый проект
#    с другим DB_NAME/DB_USER, шаги идемпотентны)
DB_PASSWORD='выберите-надёжный-пароль' bash provision.sh

# 2. Деплой приложения (клонирует репозиторий, ставит зависимости, поднимает
#    через pm2)
REPO_URL='https://github.com/<org>/APART.git' bash deploy_apart.sh

# 3. Заполнить server/.env реальными ключами (YOOKASSA_*, TELEGRAM_*, DB_*, GEMINI_*)
nano /opt/apart-server/server/.env
pm2 restart apart-server --update-env

# 4. nginx + HTTPS (apart247.ru — отдельный домен под API, не поддомен radegust.ru)
cp nginx-apart.conf /etc/nginx/sites-available/apart
ln -s /etc/nginx/sites-available/apart /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d apart247.ru
# До этого — в DNS-панели регистратора apart247.ru должна быть A-запись на IP сервера

# 5. Контент-крон (публикация постов по расписанию)
crontab -e
# добавить строку:
# */5 * * * * cd /opt/apart-server/server && node src/content/run.js >> /var/log/apart-content.log 2>&1
```

## Повторный деплой (обновление кода)

```bash
REPO_URL='https://github.com/<org>/APART.git' bash deploy_apart.sh
```
(при уже склонированном репозитории `REPO_URL` не обязателен — скрипт сам сделает `git pull`).

## Следующие проекты (другие вертикали)

Каждый проект — своя база данных на этом же MySQL-сервере (см. `server/README.md`):
```bash
DB_NAME=lamps DB_USER=lamps DB_PASSWORD='...' bash provision.sh
```
Шаги system-level (firewall, Node.js, nginx, pm2) не выполняются повторно — только создание базы/пользователя.
