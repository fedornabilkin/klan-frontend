# Klan Frontend

Самостоятельный интерфейс закрытого сообщества Klan: Vue 3, TypeScript, Vite, Pinia, Pug, Naive UI и D3. Для локальной разработки достаточно Node.js 22.12+ и npm; Docker не требуется.

## Локальный запуск

Из корня репозитория:

```sh
cd Project
npm run setup:local
npm ci
npm run dev
```

Адрес: `http://localhost:5173`. API запускается отдельно; по умолчанию он ожидается на `http://127.0.0.1:3001`. Настройки прокси и порта находятся в `Project/.env`: `VITE_API_TARGET` и `VITE_DEV_PORT`. В backend `APP_ORIGIN` должен совпадать с адресом браузера. Переменные `VITE_*` публичны, секреты в них хранить нельзя.

В Windows можно открыть `Scripts/start-local.cmd`: он подготовит локальное окружение, при необходимости установит зависимости и запустит Vite. При обновлении со старой структуры сначала остановите старый Vite, затем выполните `setup:local`: настройки копируются в `Project/` без перезаписи существующих значений и без удаления оригиналов.

Проверки и сборка выполняются из `Project/`:

```sh
npm run typecheck
npm test
npm run build
```

Сборка создаётся в `Project/dist/`. Исходники других репозиториев не нужны.

## Структура

| Каталог | Назначение |
| --- | --- |
| `Project/` | Исходники, package/lockfile, Vite/TypeScript, локальный `.env`, зависимости и сборка |
| `Docker/` | Dockerfile, Compose, Dockerfile-specific ignore и пример окружения контейнеров |
| `Deploy/` | Публикация статики, конфигурация nginx; отдельные варианты Caddy/systemd |
| `Scripts/` | Подготовка окружения и локальный запуск |
| `Docs/` | Архитектура, требования и развёртывание |
| `Agreements/` | Правила разработки и русских сообщений коммитов |

Реальные анкеты, выгрузки, резервные копии и секреты не публикуются в Git.

## Развёртывание

Скачайте [setup-server.sh](Deploy/setup-server.sh) на VPS и выполните `sudo bash setup-server.sh`: он настроит все компоненты, nginx и HTTPS. Для одного frontend используйте `sudo bash setup-server.sh frontend`. [Короткая инструкция](Docs/deployment-github-vps.md) описывает вопросы установщика и GitHub-настройки.

Далее push/merge в `main` запускает Production: GitHub собирает статику, передаёт архив с SHA256 и публикует файлы в `/var/www/klan`. После проверки HTTPS сохраняется предыдущая версия для отката. Настройки GitHub можно заполнить с компьютера через `bash setup-server.sh github` для всех компонентов, `bash setup-server.sh github frontend` для одного frontend или вручную по инструкции.

Дополнительные ручные варианты Docker/Caddy — в [deployment.md](Docs/deployment.md); диагностика, миграция и восстановление — в [справочнике эксплуатации](Docs/operations.md).

См. [архитектуру](Docs/architecture.md), [требования](Docs/requirements.md) и [соглашения](Agreements/CONVENTIONS.md).
