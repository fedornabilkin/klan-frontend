# GitHub Actions → GHCR → VPS: фронтенд

Production развёртывается из `main` отдельным проектом `klan-frontend-production`. CI собирает `Docker/Dockerfile` из корня репозитория и публикует образ в GHCR. VPS получает готовый образ по неизменяемому digest `IMAGE_REF=ghcr.io/…@sha256:…`; Node.js и исходники для сборки на сервере не нужны.

Общая подготовка VPS, SSH/GHCR, порядок запуска backend → frontend → bot и восстановление описаны в [руководстве backend](https://github.com/fedornabilkin/klan-backend/blob/main/Docs/deployment-github-vps.md). Этот документ описывает настройки интерфейса и внешнего nginx. Для локальной разработки по-прежнему подходят [обычные инструкции](deployment.md).

## Схема доступа

- nginx на хосте принимает HTTP/HTTPS на 80/443 и хранит сертификаты Certbot.
- `/api`, `/api/*`, `/ws`, `/ws/*` идут из nginx **напрямую** в `127.0.0.1:3101` — опубликованный на loopback порт backend. Пути не переписываются, WebSocket Upgrade передаётся.
- `/internal` и `/internal/*` возвращают 404; браузеру эти маршруты недоступны.
- Статика и SPA-маршруты идут в `127.0.0.1:8088` → Caddy `:80` внутри контейнера frontend. Caddy возвращает `index.html` для адресов приложения.
- Frontend подключён к существующей Docker-сети `klan-production`; адрес API внутри неё — `api:3001`. HTTPS внутри контейнера выключен. Порт 443 контейнера не публикуется.

В backend установите `APP_ORIGIN=https://ВАШ-ДОМЕН` без завершающего `/`. Браузер использует cookie и WebSocket на том же origin. У backend остаётся один доверенный proxy hop. nginx заменяет `X-Forwarded-For` адресом своего клиента, а не принимает входящий заголовок на веру. Дополнительный CDN или балансировщик перед nginx потребует отдельной настройки доверия; эта схема предполагает прямое подключение клиента к nginx.

## GitHub environment `production`

В репозитории создайте Settings → Environments → `production` и добавьте secrets:

| Secret | Значение |
| --- | --- |
| `DEPLOY_HOST` | Адрес подготовленного VPS |
| `DEPLOY_PORT` | SSH-порт, обычно `22` |
| `DEPLOY_USER` | Пользователь деплоя из общего руководства |
| `DEPLOY_SSH_KEY` | Его закрытый SSH-ключ для Actions |
| `DEPLOY_KNOWN_HOSTS` | Проверенная запись ключа хоста; для нестандартного порта формат `[host]:port` |
| `PRODUCTION_ENV` | Содержимое [Docker/.env.production.example](../Docker/.env.production.example), включая комментарий, если дополнительных настроек нет |

Ключ хоста проверьте по доверенному каналу администратора VPS. Секрет `PRODUCTION_ENV` содержит raw-строки `KEY=value`, без `export`, кавычек вокруг значения и подстановок shell. Знаки `$` и кавычки сохраняются буквально. Фронтенду сейчас не нужны дополнительные значения: достаточно комментария из примера. Не копируйте сюда секреты backend, базу или Telegram token. `KLAN_DOMAIN=:80`, `API_UPSTREAM=api:3001` и `FRONTEND_ROOT=/srv` фиксированы в Compose; `IMAGE_REF` задаёт workflow.

Нужен Docker Compose **2.30.0+** для `env_file.format: raw`; на VPS должны быть `curl` и общие инструменты из руководства backend. Workflow передаёт временный `GITHUB_TOKEN` серверу через stdin, использует отдельный `DOCKER_CONFIG` и удаляет его после скачивания образа; постоянная авторизация GHCR на VPS не нужна. Публикация образа выполняется GitHub Actions с правами пакетов своего репозитория.

Workflow `Production` запускается при изменениях в `main`; ручной запуск выполняйте для `main`. Разрешите в environment только ветку `main`. Для автоматического деплоя без ручных подтверждений не включайте required reviewers и wait timer в environment `production`.

## Первичная настройка nginx и HTTPS

Команды ниже предназначены для администратора Debian/Ubuntu VPS. Выполняйте их после общей подготовки сервера. Замените **все** `klan.example.org` и `admin@example.org` своими значениями, направьте DNS A/AAAA на VPS и откройте TCP 80/443. Не публикуйте 8088 и 3101 наружу. На сервере должны быть установлены nginx и Certbot по инструкции вашей ОС.

Сначала используйте HTTP-конфигурацию без ссылок на ещё не выпущенный сертификат:

```sh
sudo install -d -m 0755 /var/www/letsencrypt/.well-known/acme-challenge
sudo tee /etc/nginx/sites-available/klan-frontend >/dev/null <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name klan.example.org;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }
    location / { return 503; }
}
NGINX
sudo ln -sfn /etc/nginx/sites-available/klan-frontend /etc/nginx/sites-enabled/klan-frontend
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/letsencrypt \
  -d klan.example.org --email admin@example.org --agree-tos --non-interactive
```

Убедитесь, что другой виртуальный хост не обслуживает тот же домен. После успешной выдачи сертификата подготовьте копию [Deploy/nginx.production.conf](../Deploy/nginx.production.conf), замените в ней все вхождения домена, включая пути сертификатов, и установите её вместо HTTP-конфигурации:

```sh
# /tmp/klan-frontend.nginx.conf — подготовленная копия с вашим доменом.
sudo install -m 0644 /tmp/klan-frontend.nginx.conf /etc/nginx/sites-available/klan-frontend
sudo nginx -t && sudo systemctl reload nginx
```

Настройте перезагрузку nginx после обновления сертификата:

```sh
sudo install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-klan-nginx >/dev/null <<'HOOK'
#!/bin/sh
nginx -t && systemctl reload nginx
HOOK
sudo chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/reload-klan-nginx
sudo certbot renew --dry-run
```

Проверьте, что установленный Certbot запускает автоматическое обновление через timer или cron. Публичный HTTP после установки основной конфигурации перенаправляется на HTTPS; ACME challenge остаётся доступен на 80. nginx на хосте не меняется при каждом релизе приложения; обновления этого шаблона применяются администратором отдельно.

## Релиз и проверка

Каждый релиз хранится в `/opt/klan/frontend/releases/<SHA>-<run>-<attempt>/` и содержит `Docker/compose.production.yaml`, сценарии `Deploy/*.sh`, `runtime.env` и метаданные образа. Параметры и история релизов не входят в Git. Общий серверный сценарий сериализует деплои, скачивает образ, проверяет конфигурацию до замены контейнера, запускает сервис и только после проверки атомарно обновляет ссылки `current`/`previous`. При ошибке используется предыдущий релиз и его образ. Это обновление одного контейнера с возможным коротким перерывом, не схема безостановочного переключения.

Ручной откат выполняется на VPS от пользователя деплоя:

```sh
bash /opt/klan/frontend/current/Deploy/server-release.sh rollback
```

Откат использует сохранённый локальный образ предыдущего релиза и не обращается к GHCR. Не удаляйте образы и каталоги `current`/`previous`, пока они нужны для восстановления.

`Deploy/service.sh` предоставляет hooks общему сценарию:

1. `service_preflight` запускает `caddy validate` в одноразовом контейнере без публикации портов.
2. `service_start` запускает только `frontend` через `compose up -d --no-build --wait --wait-timeout 120`.
3. `service_verify` проверяет через loopback главную страницу, прямой SPA-адрес `/users/1`, 404 для `/internal` и вложенного адреса. Healthcheck контейнера также проверяет HTML приложения.
4. `service_stop` останавливает только frontend этого Compose-проекта; backend, bot и общую сеть он не останавливает.

После первого запуска проверьте внешний адрес:

```sh
curl --fail --show-error https://klan.example.org/
curl --fail --show-error https://klan.example.org/users/1
curl --fail --show-error https://klan.example.org/api/health
curl --silent --output /dev/null --write-out '%{http_code}\n' https://klan.example.org/internal
curl --silent --output /dev/null --write-out '%{http_code}\n' https://klan.example.org/internal/health
```

Последние два запроса должны вернуть `404`. В браузере отдельно проверьте вход и авторизованное соединение `wss://ВАШ-ДОМЕН/ws`. Автоматическая проверка статического контейнера не подтверждает работоспособность API, внешнего TLS, DNS или Telegram-входа. Не используйте реальные сообщения Telegram и изменения данных для проверки без отдельного разрешения.

Локальные проверки из `Project/`: `npm test`, `npm run build`. Из корня репозитория: `bash -n Deploy/service.sh` и `bash Scripts/test-deployment-service.sh`. Последний тест подменяет Compose и HTTP-запросы и проверяет передачу ошибок, SPA-маршруты и запрет внутренних адресов, не обращаясь к серверу.

Официальные справочники: [Compose env_file](https://docs.docker.com/reference/compose-file/services/#env_file), [nginx WebSocket](https://nginx.org/en/docs/http/websocket.html), [Certbot webroot и обновление](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).
