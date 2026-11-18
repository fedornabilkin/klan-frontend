# GitHub Actions → SSH → nginx: фронтенд

Workflow [Production](../.github/workflows/deploy.yml) собирает `Project/dist` в GitHub Actions, упаковывает его в `frontend.tar.gz` и передаёт на VPS вместе с SHA256. Установленный nginx обслуживает готовые файлы из `/var/www/klan`. Node.js нужен только runner для сборки; frontend не использует Docker, Caddy, GHCR или промежуточный порт 8088 в этой схеме.

Общая подготовка VPS и порядок первого запуска backend → frontend → bot описаны в [руководстве backend](https://github.com/fedornabilkin/klan-backend/blob/main/Docs/deployment-github-vps.md). Отдельные ручные варианты Docker/Caddy и локальная разработка сохранены в [обычной инструкции](deployment.md).

## Подготовка сервера

Используйте существующий nginx, SSH-пользователя deploy и HTTPS-домен на VPS. Для frontend нужны Bash, `curl`, `find`, `flock`, `grep`, `realpath`, `rsync`, `sha256sum` и `tar` с gzip. Общий `Deploy/setup-server.sh` из backend проверяет инструменты и создаёт нужные каталоги; повторять их создание вручную не требуется.

| Путь | Назначение |
| --- | --- |
| `/var/www/klan` | Публичная статика, читаемая nginx; deploy может обновлять файлы |
| `/opt/klan/frontend/incoming/<SHA>-<run>-<attempt>` | Приватный входящий архив, checksum, сценарий и метаданные |
| `/opt/klan/frontend/releases/<SHA>-<run>-<attempt>` | Приватный сохранённый релиз; публикуется только его `public/` |
| `/opt/klan/frontend/releases/bootstrap-<timestamp>-<PID>` | Снимок содержимого web-root перед первой публикацией |
| `/opt/klan/frontend/static-current`, `static-previous` | Ссылки на активный и предыдущий статические релизы |

Общий setup создаёт `/opt/klan/frontend` и его приватные каталоги с правами `0700`, а `/var/www/klan` — `0755`. Web-root должен быть обычным каталогом, без симлинка, `.git`, `Project` и исходного `package.json`. Сценарий копирует только публичные файлы; архивы, сценарии и исторические env-файлы в web-root не попадают. `.well-known/` сохраняется при публикации.

## Схема доступа

- nginx принимает HTTP/HTTPS на 80/443 и хранит сертификаты Certbot.
- `/api`, `/api/*`, `/ws`, `/ws/*` идут напрямую в `127.0.0.1:3101`; пути не переписываются, WebSocket Upgrade передаётся.
- `/internal` и `/internal/*` возвращают `404`.
- Статика читается из `/var/www/klan`; маршруты приложения возвращают `index.html`. Отсутствующие `/assets/*` возвращают `404`.
- `index.html` получает `Cache-Control: no-cache`; маркеры публикации — `no-store`, хешированные assets — длительный immutable cache.

В backend установите `APP_ORIGIN=https://ВАШ-ДОМЕН` без завершающего `/`. Браузер использует относительный `/api` и WebSocket на том же origin; production build не требует API URL. `VITE_API_TARGET` относится к локальному dev-прокси. У backend остаётся один доверенный proxy hop: nginx заменяет `X-Forwarded-For` адресом своего клиента. Дополнительный CDN или балансировщик потребует отдельной настройки доверия.

## GitHub environment `production`

В репозитории создайте **Settings → Environments → production**. Разрешите deployment только из `main`; выключите required reviewers и wait timer, чтобы успешные проверки автоматически приводили к публикации.

Добавьте пять **Environment secrets**:

| Secret | Значение |
| --- | --- |
| `DEPLOY_HOST` | DNS-имя или IPv4 подготовленного VPS |
| `DEPLOY_PORT` | SSH-порт, обычно `22` |
| `DEPLOY_USER` | Подготовленный пользователь, обычно `deploy` |
| `DEPLOY_SSH_KEY` | Полный приватный SSH-ключ для Actions |
| `DEPLOY_KNOWN_HOSTS` | Проверенная запись ключа хоста; для нестандартного порта — `[host]:port` |

В том же environment добавьте публичную **Variable** `PRODUCTION_URL`, например `https://klan.example.org`. Это HTTPS origin без пути, query и fragment; завершающий `/` допустим. Значение используется для проверки именно опубликованного сайта. Domain/TLS и nginx должны быть готовы до первого запуска workflow.

Ключ SSH-хоста сверяйте через доверенный канал администратора. Скрипт включает `StrictHostKeyChecking=yes`, использует только переданный ключ и не доверяет серверу через динамический `ssh-keyscan`.

Frontend не требует `PRODUCTION_ENV`, runtime-секретов, registry token или `IMAGE_REF`. Старые значения этих secrets workflow больше не читает. Не передавайте сюда секреты API, базы или Telegram. Все `VITE_*` публичны и могут попасть в сборку.

## Первичная настройка nginx и HTTPS

Команды предназначены для администратора Debian/Ubuntu VPS после общего setup. Замените **все** `klan.example.org` и `admin@example.org`, направьте DNS A/AAAA на VPS и откройте TCP 80/443. Не публикуйте порт API 3101 наружу. nginx и Certbot должны быть установлены по инструкции ОС. Не меняйте virtual hosts других проектов.

Для нового домена сначала установите HTTP-конфигурацию без ссылок на ещё не выпущенный сертификат:

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

Убедитесь, что другой virtual host не обслуживает тот же домен. После выдачи сертификата подготовьте копию [Deploy/nginx.production.conf](../Deploy/nginx.production.conf), замените все вхождения домена, включая пути сертификатов, и установите её:

```sh
# /tmp/klan-frontend.nginx.conf — подготовленная копия с вашим доменом.
sudo install -m 0644 /tmp/klan-frontend.nginx.conf /etc/nginx/sites-available/klan-frontend
sudo nginx -t && sudo systemctl reload nginx
```

Если домен уже обслуживает прежний frontend-контейнер, не заменяйте работающий vhost временным `503`: используйте существующий сертификат и порядок миграции ниже. На новом пустом сайте до первой публикации отсутствие `index.html` ожидаемо; workflow сначала записывает сборку, затем проверяет её через HTTPS.

Настройте reload nginx после обновления сертификата:

```sh
sudo install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-klan-nginx >/dev/null <<'HOOK'
#!/bin/sh
nginx -t && systemctl reload nginx
HOOK
sudo chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/reload-klan-nginx
sudo certbot renew --dry-run
```

Проверьте автоматическое обновление Certbot через timer или cron. HTTP перенаправляется на HTTPS, ACME challenge остаётся доступен на 80. Workflow не устанавливает и не перезагружает nginx; изменения шаблона администратор применяет отдельно.

## Переход с ранее опубликованного frontend-контейнера

Этот раздел нужен только для работающей старой схемы `klan-frontend-production`, где nginx проксирует UI на `127.0.0.1:8088`. Сначала выполните общий setup и подготовьте новую nginx-конфигурацию. Новый workflow запускайте после переключения nginx на статику. Старый контейнер оставьте работающим до успешной проверки перехода.

От имени пользователя deploy найдите единственный старый frontend-контейнер и скопируйте его текущую статику в **пустой** новый web-root. Следующий блок не перезаписывает уже настроенную статическую публикацию:

```bash
set -euo pipefail
old_container=$(docker ps \
  --filter label=com.docker.compose.project=klan-frontend-production \
  --filter label=com.docker.compose.service=frontend --format '{{.ID}}')
[[ "$old_container" =~ ^[a-f0-9]+$ ]]
test ! -e /opt/klan/frontend/static-current
test ! -L /opt/klan/frontend/static-current
test -z "$(find /var/www/klan -mindepth 1 -maxdepth 1 ! -name .well-known -print -quit)"
migration_dir=$(mktemp -d /opt/klan/frontend/migration-XXXXXX)
docker cp "$old_container:/srv/." "$migration_dir/"
test -f "$migration_dir/index.html"
test -z "$(find "$migration_dir" ! -type f ! -type d -print -quit)"
test -z "$(find "$migration_dir" -mindepth 1 -name '.*' -print -quit)"
rsync --archive --checksum --exclude='.well-known/' \
  --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r "$migration_dir/" /var/www/klan/
```

Сохраните прежний vhost и установите подготовленный static-шаблон с тем же доменом и сертификатом:

```sh
sudo cp -p /etc/nginx/sites-available/klan-frontend /opt/klan/frontend/nginx.before-static.conf
sudo install -m 0644 /tmp/klan-frontend.nginx.conf /etc/nginx/sites-available/klan-frontend
sudo nginx -t && sudo systemctl reload nginx
```

В той же shell-сессии проверьте, что публичный адрес отдаёт ровно перенесённый `index.html`, и что API и SPA-маршрут доступны:

```bash
curl --fail --silent --show-error --max-time 20 \
  https://klan.example.org/ -o "$migration_dir/published-index.html"
expected=$(sha256sum /var/www/klan/index.html)
actual=$(sha256sum "$migration_dir/published-index.html")
test "${expected%% *}" = "${actual%% *}"
curl --fail --show-error https://klan.example.org/users/1 >/dev/null
curl --fail --show-error https://klan.example.org/api/health
```

Если проверка не прошла, восстановите `/opt/klan/frontend/nginx.before-static.conf` в прежний vhost, выполните `nginx -t` и reload: старый контейнер всё ещё работает. После успешного переключения запустите новый workflow **Production** и дождитесь зелёного результата. Только затем остановите сохранённый контейнер командой `docker stop "$old_container"`. Не выполняйте общий `compose down` и не удаляйте volumes других компонентов.

Первая статическая публикация сама сохранит перенесённые файлы как bootstrap-релиз. Старые контейнерные ссылки `current`/`previous` не используются и не перезаписываются: новая схема ведёт отдельные `static-current`/`static-previous`. Автоматизация прежнего контейнерного способа после перехода больше не должна запускаться.

## Выпуск и проверка

Push или merge в `main` запускает **Production**. Pull request выполняет только проверки. Для повторного выпуска выберите **Actions → Production → Run workflow → main**. Уже устаревший запуск отклоняется, если вершина `main` изменилась. GitHub concurrency и серверный `flock` сериализуют публикации.

CI выполняет `npm test`, `npm run build`, проверку Bash/ShellCheck и deployment-тесты. [Deploy/package.sh](../Deploy/package.sh) добавляет в готовую сборку `deploy-version.txt` с 40-символьным SHA и `deploy-site.txt` со значением `klan-frontend`, затем создаёт `frontend.tar.gz` и `frontend.tar.gz.sha256`. Checksum-файл содержит только 64 hex-символа и перевод строки. GitHub artifact хранится 14 дней.

[Deploy/deploy.sh](../Deploy/deploy.sh) проверяет checksum до передачи и отправляет архив, сценарий и метаданные по SSH. [Deploy/server-release.sh](../Deploy/server-release.sh) повторно проверяет SHA256, имена и типы файлов архива; симлинки, специальные файлы и выход за каталог отклоняются. В приватном релизе создаются `public/`, `Deploy/server-release.sh`, `kind=static`, `commit` и `production-url`.

Публикация переносит только `public/` в web-root через `rsync --checksum --delete-after --delay-updates` с правами чтения для nginx. `.well-known/` сохраняется. Затем сервер по публичному HTTPS проверяет маркеры сайта/версии и совпадение `index.html` на `/` и `/users/1`. Только успешная проверка переключает `static-current` и `static-previous`. Это обновление файлов; атомарное переключение всех assets одновременно не обещается.

Проверьте первый выпуск снаружи:

```sh
curl --fail --show-error https://klan.example.org/deploy-site.txt
curl --fail --show-error https://klan.example.org/deploy-version.txt
curl --fail --show-error https://klan.example.org/users/1
curl --fail --show-error https://klan.example.org/api/health
curl --silent --output /dev/null --write-out '%{http_code}\n' https://klan.example.org/internal
curl --silent --output /dev/null --write-out '%{http_code}\n' https://klan.example.org/internal/health
```

Маркеры должны содержать `klan-frontend` и SHA опубликованного коммита, последние два запроса — вернуть `404`. Проверка статической публикации не подтверждает Telegram-вход и авторизованный WebSocket; их проверяют отдельно обычным пользовательским сценарием, без изменения реальных данных ради теста.

## Восстановление и ручной rollback

Если передача, checksum или распаковка не прошли, опубликованные файлы не меняются. При ошибке после начала публикации сценарий восстанавливает предыдущую статику, проверяет её и возвращает прежние ссылки. Workflow остаётся красным даже после успешного восстановления. Если восстановление не удалось, журнал содержит `ROLLBACK FAILED`.

Перед первым выпуском автоматически сохраняется bootstrap-снимок web-root; `kind=bootstrap` не требует маркеров версии. При наличии старого `index.html` его восстановление проверяется через HTTPS, для изначально пустого сайта сравниваются восстановленные файлы. Таким образом, неудачный первый выпуск может вернуть прежний пустой сайт, а не рабочую новую версию.

Ручной откат выполняется на VPS пользователем deploy:

```sh
bash /opt/klan/frontend/static-current/Deploy/server-release.sh rollback
```

Команда публикует `static-previous`, проверяет результат и после успеха меняет ссылки местами. Пересборка, GitHub и registry не нужны; нужен доступ к публичному HTTPS-адресу для проверки. Откат меняет только статику frontend, не nginx, backend, bot или базу. Следующий merge снова запускает обычную публикацию, поэтому исправьте причину ошибки либо сделайте revert в Git.

Сценарии не удаляют автоматически incoming, releases и bootstrap-снимки. Контролируйте диск и сохраняйте как минимум текущий и предыдущий статические релизы. Не удаляйте старые контейнерные каталоги/секреты, пока отдельно не решили вопрос их хранения. Web-root не предназначен для ручных правок: следующий выпуск заменит публичные файлы, кроме `.well-known/`.

## Локальные проверки

Из `Project/`: `npm test`, `npm run build`. Из корня репозитория:

```sh
for script in Deploy/*.sh; do bash -n "$script"; done
shellcheck Deploy/*.sh
node --test Deploy/*.test.mjs
```

Deployment-тесты используют изолированные файлы и подставные команды, без реального VPS или Telegram. Конфигурацию nginx проверяйте через `nginx -t`; HTTP-проверка с временной копией конфига и подставным API может выполняться на loopback.

Справочники: [nginx WebSocket](https://nginx.org/en/docs/http/websocket.html), [Certbot webroot и обновление](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).
