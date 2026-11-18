# Подготовка сервера Клана

На общем VPS с Debian или Ubuntu нужен существующий пользователь `deploy` с доступом к Docker. Скопируйте на сервер [setup-server.sh](../Deploy/setup-server.sh) из любого репозитория Клана. В каталоге с файлом выполните одну команду.

```sh
sudo bash setup-server.sh
```

Скрипт создаст в `/opt/klan` отдельные каталоги фронтенда, бэкенда и бота с правами для `deploy`, а для статики — `/var/www/klan`. В Docker он подготовит сеть `klan-production` и постоянные тома для PostgreSQL и позиции чтения бота. Запуск можно повторять.

Для отдельного сервера добавьте к команде `frontend`, `backend` или `bot`. Docker нужен для бэкенда и бота. Подготовка выполняется локально на VPS. IP и порт указываются позднее, при подключении сайта. Для входа по IP понадобится HTTPS с сертификатом на этот IP.

## Подключение сайта по IP и порту

Сохраните [setup-deployment.sh](../Deploy/setup-deployment.sh) рядом с [setup-server.sh](../Deploy/setup-server.sh). На VPS выполните `sudo bash setup-deployment.sh configure-ip`. Укажите публичный IPv4, HTTPS-порт (по умолчанию `8443`) и параметры бота. Мастер настроит nginx, сохранит адрес сайта в настройках API и получит автоматически обновляемый сертификат на IP. Для проверки Let’s Encrypt нужен входящий TCP 80. Для сайта откройте выбранный HTTPS-порт. [Сертификаты на IP](https://letsencrypt.org/2026/03/11/shorter-certs-certbot)

Чтобы разрешить вход по аккаунту Telegram без проверки групп, выполните `sudo env TELEGRAM_REQUIRE_GROUP_MEMBERSHIP=false bash setup-deployment.sh configure-ip`. Мастер запросит данные бота и предложит указать числовые ID администраторов. Подтверждение входа через бота остаётся обязательным.

Для подключения GitHub выполните на своём компьютере `bash setup-deployment.sh github`. Введите тот же HTTPS-адрес с портом, например `https://203.0.113.10:8443`. Для настройки одного репозитория добавьте `frontend`, `backend` или `bot`. GitHub Actions запускает проверки и выкладку после мержа в `main`. Для первого ручного выпуска дождитесь готовности API до запуска фронтенда и бота.

## Справка для установки с доменом

Для этого сценария сохраните [setup-deployment.sh](../Deploy/setup-deployment.sh) рядом с [setup-server.sh](../Deploy/setup-server.sh).

1. Направьте DNS сайта на VPS и откройте TCP 80 и 443. На веб-сервере выполните `sudo bash setup-deployment.sh configure-domain frontend`. Мастер настроит nginx и HTTPS и при первом выпуске сертификата спросит email. Для API на том же сервере подойдёт `http://127.0.0.1:3101`. В бэкенде значение `APP_ORIGIN` должно совпадать с публичным HTTPS-адресом сайта.
2. Чтобы подключить репозиторий фронтенда к VPS, на своём компьютере войдите через `gh auth login` и выполните `bash setup-deployment.sh github frontend`. Мастер заполнит пять SSH-секретов и переменную `PRODUCTION_URL` в окружении `production`. Для ручной настройки используйте [список параметров](operations.md#github-environment-production).
3. Мерж в `main` запускает [Production](../.github/workflows/deploy.yml). Для первого или повторного выпуска выберите Actions → Production → Run workflow → main. GitHub передаст архив статики с SHA256. Сервер опубликует файлы и проверит версию по HTTPS. При ошибке он восстановит предыдущую статику.

Для ручного возврата версии выполните от `deploy` команду `bash /opt/klan/frontend/static-current/Deploy/server-release.sh rollback`. [Справочник по nginx, миграции и обслуживанию](operations.md) · [Локальный запуск и Docker/Caddy](deployment.md)
