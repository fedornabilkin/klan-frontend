# Развёртывание фронтенда

Для автоматического production-деплоя из GitHub используйте [GitHub Actions → GHCR → VPS](deployment-github-vps.md). В той схеме TLS завершает nginx на хосте, а Caddy внутри контейнера обслуживает HTTP. Этот документ описывает разработку и самостоятельный запуск с Caddy.

Фронтенд собирается из одного репозитория. Во время работы ему нужен доступный Klan API: браузер обращается к `/api` и `/ws` на своём origin, веб-сервер проксирует запросы в API. Настройка upstream выполняется при запуске веб-сервера и не требует пересборки приложения.

## Локальная разработка без Docker

Нужны Node.js 22.12+ и npm. Из корня репозитория:

```sh
cd Project
npm run setup:local
npm ci
npm run dev
```

Подготовка создаёт `Project/.env` из `Project/.env.example`, если настройки ещё отсутствуют. Существующие значения сохраняются. Vite читает окружение из `Project/`; для индивидуальных переопределений подходит `Project/.env.local`.

По умолчанию фронтенд доступен на `http://localhost:5173`, API ожидается на `http://127.0.0.1:3001`. Задайте `VITE_DEV_PORT` и `VITE_API_TARGET` для другого адреса. Занятый порт вызывает явную ошибку. В backend `APP_ORIGIN` должен точно совпадать с origin браузера, включая порт. Docker и Caddy для разработки не нужны.

В Windows тот же запуск выполняет `Scripts/start-local.cmd`. Скрипт использует Node.js/npm с компьютера, подготавливает настройки, устанавливает отсутствующие зависимости и оставляет Vite в открытом окне. Backend и bot запускаются своими командами.

После обновления старой структуры сначала остановите старый Vite, затем выполните подготовку. Скрипт копирует локальные настройки и `.local` из прежнего корня в `Project/`, не перезаписывая существующие файлы и не удаляя оригиналы. Старые `node_modules` и `dist` не нужны: новые зависимости устанавливаются и сборка создаётся внутри `Project/`.

## Docker Compose

Нужны Docker Engine с `host-gateway` и Docker Compose v2. Команды Docker в этом документе выполняются из корня репозитория. Настройки контейнеров хранятся отдельно от Vite:

```sh
cp Docker/.env.example Docker/.env
docker compose --env-file Docker/.env -f Docker/compose.yaml config --quiet
docker compose --env-file Docker/.env -f Docker/compose.yaml up -d --build
docker compose --env-file Docker/.env -f Docker/compose.yaml logs -f frontend
```

В PowerShell копирование выполняется через `Copy-Item Docker/.env.example Docker/.env`. Не заменяйте уже заполненный файл. Compose запускает только фронтенд. Build context — корень репозитория; Dockerfile — `Docker/Dockerfile`, правила исключений — `Docker/Dockerfile.dockerignore`. В образ входят сборка из `Project/` и `Deploy/Caddyfile`, локальные `.env` и зависимости не копируются.

Адрес по умолчанию — `http://localhost:8080`; для такого локального запуска API должен принимать `APP_ORIGIN=http://localhost:8080`. Контейнер обслуживает `Project/dist` через Caddy, Node.js на хосте не нужен. Сертификаты сохраняются в томе `caddy_data`.

| Переменная Docker/.env | По умолчанию | Назначение |
| --- | --- | --- |
| `KLAN_DOMAIN` | `:80` | Локальный HTTP или production-домен |
| `API_UPSTREAM` | `host.docker.internal:3001` | Адрес API, доступный из контейнера |
| `FRONTEND_BIND` | `127.0.0.1` | Интерфейс хоста для публикации портов |
| `FRONTEND_HTTP_PORT` | `8080` | HTTP-порт хоста |
| `FRONTEND_HTTPS_PORT` | `8443` | HTTPS-порт хоста, TCP и UDP |
| `KLAN_NETWORK` | `klan` | Имя существующей общей сети при использовании override |

На Docker Desktop `host.docker.internal` позволяет обратиться к API на хосте. В Linux задан `host-gateway`, но API, слушающий только `127.0.0.1` хоста, через Docker bridge недоступен. Если API тоже в Docker, используйте общую сеть. Не открывайте API всему интернету ради связи контейнеров.

После изменения окружения повторите `up -d`; при изменении исходников добавьте `--build`. Остановка:

```sh
docker compose --env-file Docker/.env -f Docker/compose.yaml down
```

Не добавляйте `--volumes`, если хотите сохранить сертификаты.

### Отдельные Docker-проекты frontend и API

Создайте сеть один раз:

```sh
docker network create klan
```

Подключите API к этой сети средствами его репозитория с alias `api`. В `Docker/.env` фронтенда задайте `API_UPSTREAM=api:3001` и `KLAN_NETWORK=klan`. Используйте два локальных файла:

```sh
docker compose --env-file Docker/.env -f Docker/compose.yaml -f Docker/compose.network.yaml config --quiet
docker compose --env-file Docker/.env -f Docker/compose.yaml -f Docker/compose.network.yaml up -d --build
```

Все последующие `logs`, `up` и `down` выполняйте с теми же параметрами. Конфигурация не читает файлы другого репозитория. Пока API недоступен, его маршруты возвращают ошибку шлюза.

### Домен и HTTPS на сервере

Направьте DNS домена на сервер, откройте TCP 80/443; UDP 443 нужен для HTTP/3. Пример `Docker/.env` при API в общей Docker-сети:

```dotenv
KLAN_DOMAIN=klan.example.org
FRONTEND_BIND=0.0.0.0
FRONTEND_HTTP_PORT=80
FRONTEND_HTTPS_PORT=443
API_UPSTREAM=api:3001
KLAN_NETWORK=klan
```

Для API на другой машине задайте доступный адрес; для TLS upstream можно использовать `https://api.internal.example.org`. В backend задайте `APP_ORIGIN=https://klan.example.org` и production-настройки авторизации. Klan использует Telegram-ссылку Start; настройка домена Telegram Login Widget для этого сценария не требуется.

Caddy автоматически выдаёт и обновляет сертификат домена. Если TLS завершается на внешнем балансировщике, используйте `KLAN_DOMAIN=:80` и внутренний порт, а цепочку доверенных прокси согласуйте с backend. Текущий API доверяет одному proxy hop; дополнительный балансировщик требует проверки этой настройки.

## Сборка без Docker и обычный веб-сервер

Из корня репозитория:

```sh
cd Project
npm ci
npm run build
cd ..
```

Публикуемый артефакт — `Project/dist/`. Node.js нужен только для сборки; готовые файлы обслуживаются статическим веб-сервером. Сервер должен проксировать `/api`, `/api/*`, `/ws`, `/ws/*` в API, запрещать `/internal` и `/internal/*`, поддерживать WebSocket и возвращать `index.html` для маршрутов приложения. Готовые правила находятся в `Deploy/Caddyfile`.

Запуск Caddy из корня репозитория в Linux/macOS:

```sh
export KLAN_DOMAIN=:8080
export API_UPSTREAM=127.0.0.1:3001
export FRONTEND_ROOT="$PWD/Project/dist"
caddy validate --config Deploy/Caddyfile --adapter caddyfile
caddy run --config Deploy/Caddyfile --adapter caddyfile
```

В PowerShell переменные задаются через `$env:KLAN_DOMAIN`, `$env:API_UPSTREAM`, `$env:FRONTEND_ROOT`. Для production укажите домен и обеспечьте постоянный доступный на запись каталог сертификатов.

### Linux с systemd

Шаблон `Deploy/klan-frontend.service` предполагает Caddy в `/usr/bin/caddy`, пользователя/группу `caddy` и репозиторий в `/srv/klan/frontend`. Установите Caddy, создайте пользователя, если он отсутствует, разместите `Project/dist` и `Deploy/Caddyfile`. Пользователю достаточно чтения файлов приложения. При другом расположении исправьте пути в unit.

Создайте `/etc/klan-frontend.env`:

```dotenv
KLAN_DOMAIN=klan.example.org
API_UPSTREAM=127.0.0.1:3001
FRONTEND_ROOT=/srv/klan/frontend/Project/dist
```

Установите unit из корня репозитория:

```sh
sudo install -m 0644 Deploy/klan-frontend.service /etc/systemd/system/klan-frontend.service
sudo systemctl daemon-reload
sudo systemctl enable --now klan-frontend
sudo journalctl -u klan-frontend -f
```

Если Caddy уже запущен сервисом, примените конфигурацию к нему вместо второго экземпляра на тех же портах. Шаблон хранит сертификаты в `/var/lib/klan-frontend`. Обновление заменяет `Project/dist` новой сборкой; после изменения конфигурации или окружения перезапустите сервис.

## Проверка

- Главная страница и прямой адрес `/users/1` возвращают приложение.
- `/internal` возвращает 404; `/api/health` — ответ работающего API.
- Вход и загрузка данных работают при совпадении origin с `APP_ORIGIN` API.
- После входа доступно соединение `/ws`.

Приватные `.env`, зависимости, сборка, сертификаты и результаты проверок не входят в Git.
