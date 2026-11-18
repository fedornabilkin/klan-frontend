# Установка frontend и автодеплой

Нужны Debian/Ubuntu VPS, существующий пользователь `deploy` с доступом по SSH и домен с DNS-записями на этот сервер. Откройте TCP 80/443 и SSH-порт. GitHub собирает статику; установленный на VPS nginx обслуживает `/var/www/klan`.

1. Скачайте [setup-server.sh](../Deploy/setup-server.sh) из этого репозитория на VPS и запустите:

   ```sh
   sudo bash setup-server.sh
   ```

   По умолчанию устанавливаются все три компонента. Для одного frontend: `sudo bash setup-server.sh frontend`. Справка: `bash setup-server.sh --help`. Скрипт запросит параметры, использует существующего пользователя `deploy`, подготовит каталоги, настроит nginx и HTTPS через Certbot, покажет данные для GitHub. Для первого сертификата понадобится email. API по умолчанию доступен на `http://127.0.0.1:3101`; при отдельном сервере укажите его доступный адрес. В backend `APP_ORIGIN` должен совпадать с публичным HTTPS-адресом сайта.

2. На своём компьютере можно заполнить GitHub-настройки всех компонентов командой `bash setup-server.sh github` после входа через `gh auth login`; для одного frontend — `bash setup-server.sh github frontend`. Либо создайте **Settings → Environments → production** вручную:

   | Тип | Имена |
   | --- | --- |
   | Secrets | `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` |
   | Variable | `PRODUCTION_URL` — например `https://klan.example.org` |

   Приватный ключ относится к пользователю деплоя. Проверенную строку ключа SSH-хоста возьмите из вывода серверного скрипта. Разрешите environment только для `main`; для автоматического выпуска отключите required reviewers и wait timer.

3. Push/merge в `main` запускает [Production](../.github/workflows/deploy.yml). Повторный запуск: **Actions → Production → Run workflow → main**. После тестов workflow передаёт архив и SHA256, публикует файлы и проверяет сайт/commit через HTTPS. При ошибке восстанавливается предыдущая статика.

Ручной откат на VPS от пользователя деплоя:

```sh
bash /opt/klan/frontend/static-current/Deploy/server-release.sh rollback
```

Секреты backend и Telegram остаются на VPS и не передаются в сборку frontend. Подробности nginx, проверки, миграция и обслуживание — в [справочнике эксплуатации](operations.md); локальная разработка и ручные Docker/Caddy-варианты — в [deployment.md](deployment.md).
