# Развёртывание фронтенда

Все команды выполняются из корня этого репозитория. Исходники соседних приложений не требуются. Фронтенду нужен доступный по сети Klan API: браузер обращается к `/api` и `/ws` на своём origin, а веб-сервер проксирует запросы в API. Настройка upstream выполняется при запуске сервера и не требует пересборки приложения.

## Локальная разработка с Node.js

Нужны Node.js 22.12+ и npm:

```sh
npm ci
npm run dev
```

В Windows то же делает `start-local.cmd` из этого репозитория; зависимости устанавливаются при первом запуске. По умолчанию открывается `http://localhost:5173`, API ожидается на `http://127.0.0.1:3001`. Для другого порта/API создайте `.env.local` на основе `.env.example` и задайте `VITE_DEV_PORT`/`VITE_API_TARGET`. Бэкенд должен разрешать точный origin браузера через `APP_ORIGIN`.

## Docker Compose

Нужны Docker Engine с поддержкой `host-gateway` (20.10+) и Docker Compose v2. Скопируйте `.env.example` в `.env`, при необходимости измените настройки и запустите:

```sh
docker compose config --quiet
docker compose up -d --build
docker compose logs -f frontend
```

Адрес по умолчанию — `http://localhost:8080`; в API задайте `APP_ORIGIN=http://localhost:8080`. Контейнер собирается из текущего каталога, включает готовый `dist` и Caddy. Node.js на хосте не нужен. Compose запускает только фронтенд. Сертификаты Caddy сохраняются в именованном томе `caddy_data`.

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `KLAN_DOMAIN` | `:80` | Локальный HTTP или production-домен, например `klan.example.org` |
| `API_UPSTREAM` | `host.docker.internal:3001` | Адрес API, доступный из контейнера |
| `FRONTEND_BIND` | `127.0.0.1` | Интерфейс хоста для публикации портов |
| `FRONTEND_HTTP_PORT` | `8080` | HTTP-порт хоста |
| `FRONTEND_HTTPS_PORT` | `8443` | HTTPS-порт хоста, TCP и UDP |
| `KLAN_NETWORK` | `klan` | Имя существующей сети при использовании network override |

На Docker Desktop `host.docker.internal` позволяет обратиться к API на хосте. В Linux для этого имени задан `host-gateway`; API должен слушать адрес, доступный с Docker bridge. API, слушающий только `127.0.0.1` Linux-хоста, через bridge недоступен. Если API тоже в Docker, используйте общую сеть из следующего раздела. Не публикуйте API в интернете только ради связи контейнеров.

После изменения `.env` примените `docker compose up -d`; при изменении исходников добавьте `--build`. Остановка — `docker compose down`. Не добавляйте `--volumes`, если хотите сохранить сертификаты.

### Фронтенд и API в отдельных Docker-проектах

Создайте одну сеть на хосте:

```sh
docker network create klan
```

Подключите API к этой существующей сети средствами его репозитория, с сетевым alias `api`. Укажите в `.env` фронтенда `API_UPSTREAM=api:3001`, `KLAN_NETWORK=klan`. Запустите фронтенд с локальным override:

```sh
docker compose -f compose.yaml -f deploy/compose.network.yaml config --quiet
docker compose -f compose.yaml -f deploy/compose.network.yaml up -d --build
```

Дальнейшие команды `logs`, `down`, `up` выполняйте с теми же двумя `-f`. Порядок запуска приложений независим; пока API недоступен, его маршруты будут возвращать ошибку шлюза. Эта конфигурация не читает Compose-файлы или исходники другого репозитория.

### Домен и HTTPS на виртуальном сервере

Направьте DNS домена на сервер. Откройте входящие TCP-порты 80/443; UDP 443 нужен для HTTP/3. В `.env` фронтенда задайте:

```dotenv
KLAN_DOMAIN=klan.example.org
FRONTEND_BIND=0.0.0.0
FRONTEND_HTTP_PORT=80
FRONTEND_HTTPS_PORT=443
API_UPSTREAM=api:3001
KLAN_NETWORK=klan
```

В этом примере API находится в общей Docker-сети. Для API на другом сервере укажите его доступный адрес вместо `api:3001`; для TLS upstream можно указать `https://api.internal.example.org`. В бэкенде задайте `APP_ORIGIN=https://klan.example.org` и production-настройки сессии/Telegram согласно его инструкции. Для Telegram Login также настройте этот домен у бота.

Запустите Compose с network override, если используется общая сеть. Caddy автоматически выдаёт и обновляет сертификат для указанного домена. Если HTTPS уже завершается на внешнем балансировщике, используйте `KLAN_DOMAIN=:80`, внутренний HTTP-порт и настройки доверенных прокси в API согласно его документации.

## Без Docker: сборка Node.js и статический веб-сервер

```sh
npm ci
npm run build
```

Публикуемый артефакт — каталог `dist/`. Node.js нужен для сборки, а готовый интерфейс обслуживается обычным статическим веб-сервером. Сервер должен проксировать `/api`, `/api/*`, `/ws`, `/ws/*` в API, запрещать `/internal` и `/internal/*`, поддерживать WebSocket и возвращать `index.html` для маршрутов приложения. Эти правила уже находятся в `deploy/Caddyfile`.

Для запуска Caddy из корня репозитория в Linux/macOS:

```sh
export KLAN_DOMAIN=:80
export API_UPSTREAM=127.0.0.1:3001
export FRONTEND_ROOT="$PWD/dist"
caddy validate --config deploy/Caddyfile --adapter caddyfile
caddy run --config deploy/Caddyfile --adapter caddyfile
```

В PowerShell переменные задаются через `$env:KLAN_DOMAIN`, `$env:API_UPSTREAM`, `$env:FRONTEND_ROOT`. Убедитесь, что выбранный порт доступен процессу; для запуска без прав на порт 80 задайте `KLAN_DOMAIN=:8080`. В production укажите домен. Caddy должен иметь постоянный доступный на запись каталог для сертификатов.

### Linux с systemd

В репозитории есть `deploy/klan-frontend.service`. Он предполагает Caddy в `/usr/bin/caddy`, системного пользователя/группу `caddy` и приложение в `/srv/klan/frontend`. Установите Caddy, создайте этого пользователя, если он отсутствует, разместите сборку и `deploy/Caddyfile` по указанному пути. Пользователю `caddy` достаточно чтения файлов приложения. Измените пути в unit-файле, если используете другое расположение.

Создайте `/etc/klan-frontend.env`:

```dotenv
KLAN_DOMAIN=klan.example.org
API_UPSTREAM=127.0.0.1:3001
FRONTEND_ROOT=/srv/klan/frontend/dist
```

Затем выполните:

```sh
sudo install -m 0644 deploy/klan-frontend.service /etc/systemd/system/klan-frontend.service
sudo systemctl daemon-reload
sudo systemctl enable --now klan-frontend
sudo journalctl -u klan-frontend -f
```

На портах 80/443 не должен работать второй веб-сервер; если Caddy уже установлен как сервис, можно применить конфигурацию к нему вместо запуска второго экземпляра. Шаблон хранит сертификаты в `/var/lib/klan-frontend`. Для обновления замените `dist` новой сборкой; после изменения конфигурации или env перезапустите сервис.

## Проверка

- Откройте главную страницу и напрямую `/users/1`: обе должны возвращать приложение.
- `/internal` должен возвращать 404; `/api/health` — ответ запущенного API.
- Проверьте вход и загрузку данных; origin браузера должен совпадать с `APP_ORIGIN` бэкенда.
- Проверьте обновления через `/ws` после входа.

`.env`, зависимости, `dist`, сертификаты и результаты проверок не входят в Git. Docker не копирует локальные `.env` и зависимости в образ; параметры веб-сервера передаются при запуске.
