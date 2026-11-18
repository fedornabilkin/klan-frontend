#!/usr/bin/env bash
# Interactive website and GitHub setup.
set -euo pipefail
set +x
umask 077

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=Deploy/setup-server.sh
source "$script_dir/setup-server.sh"

ask() {
  local reply
  printf '%s' "$1" >&2
  if [[ -n "$2" ]]; then printf ' [%s]' "$2" >&2; fi
  printf ': ' >&2
  IFS= read -r reply || fail 'Ввод прерван.'
  printf '%s' "${reply:-$2}"
}
ask_secret() {
  local reply
  printf '%s (ввод скрыт): ' "$1" >&2
  IFS= read -rs reply || fail 'Ввод прерван.'
  printf '\n' >&2
  printf '%s' "$reply"
}

setup_github() (
  set +x
  set -euo pipefail
  unset GH_DEBUG
  export GH_HOST=github.com GH_PROMPT_DISABLED=1
  local command component repository permission environments host port key_path host_key key_type key_data _ignored origin='' known_host scratch website_default
  local -a components=()
  local -A existing_environment=()
  for command in gh ssh ssh-keygen mktemp; do
    command -v "$command" >/dev/null || fail "Не найдена команда: $command"
  done
  gh auth status --hostname github.com >/dev/null 2>&1 ||
    fail 'Сначала выполните gh auth login --hostname github.com.'
  for component in frontend backend bot; do
    selected "$component" || continue
    repository="fedornabilkin/klan-$component"
    permission="$(gh repo view "$repository" --json viewerPermission --jq .viewerPermission)" ||
      fail "Нет доступа к $repository."
    [[ "$permission" == ADMIN ]] || fail "Нужны права администратора $repository."
    environments="$(gh api --paginate "repos/$repository/environments" --jq '.environments[].name')" ||
      fail "Не удалось прочитать окружения $repository."
    components+=("$component")
    existing_environment["$component"]=no
    if grep -Fxq production <<< "$environments"; then existing_environment["$component"]=yes; fi
  done
  (( ${#components[@]} > 0 )) || fail 'Не выбраны компоненты для настройки.'

  host="$(ask 'SSH-адрес сервера' '')"
  [[ "$host" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || fail 'Некорректный SSH-адрес.'
  port="$(ask 'SSH-порт' '22')"
  [[ "$port" =~ ^[0-9]{1,5}$ ]] || fail 'Некорректный SSH-порт.'
  (( 10#$port >= 1 && 10#$port <= 65535 )) || fail 'SSH-порт должен быть от 1 до 65535.'
  port=$((10#$port))
  key_path="$(ask 'Путь к закрытому SSH-ключу пользователя deploy' "$HOME/.ssh/klan_deploy")"
  # shellcheck disable=SC2088
  if [[ "$key_path" == '~/'* ]]; then key_path="$HOME/${key_path:2}"; fi
  if [[ "$key_path" =~ ^[A-Za-z]:[\\/] ]] && command -v cygpath >/dev/null; then
    key_path="$(cygpath -u "$key_path")"
  fi
  [[ -f "$key_path" && -r "$key_path" ]] || fail 'Закрытый SSH-ключ не найден или недоступен для чтения.'
  ssh-keygen -y -P '' -f "$key_path" >/dev/null 2>&1 ||
    fail 'Нужен корректный SSH-ключ без passphrase, доступный текущему пользователю.'
  host_key="$(ask 'Публичный SSH-ключ сервера (ssh-ed25519 AAAA...)' '')"
  [[ "$host_key" != *$'\n'* && "$host_key" != *$'\r'* ]] || fail 'Ключ хоста должен занимать одну строку.'
  read -r key_type key_data _ignored <<< "$host_key"
  [[ "$key_type" =~ ^(ssh-ed25519|ecdsa-sha2-nistp(256|384|521)|ssh-rsa)$ && "$key_data" =~ ^[A-Za-z0-9+/]+={0,2}$ ]] ||
    fail 'Некорректный публичный ключ хоста.'
  if selected frontend; then
    website_default="https://$host"
    if is_ipv4 "$host"; then website_default="https://$host:8443"; fi
    origin="$(ask 'HTTPS-адрес сайта, включая порт' "$website_default")"
    origin=${origin%/}
    [[ "$origin" == https://* ]] || fail 'Адрес сайта должен начинаться с https://.'
    validate_origin "$origin"
    origin=${origin%:443}
    origin=${origin,,}
  fi

  scratch="$(mktemp -d)"
  trap 'rm -f -- "$scratch/known_hosts"; rmdir -- "$scratch"' EXIT
  chmod 700 "$scratch"
  known_host="$host"
  [[ "$port" == 22 ]] || known_host="[$host]:$port"
  printf '%s %s %s\n' "$known_host" "$key_type" "$key_data" > "$scratch/known_hosts"
  chmod 600 "$scratch/known_hosts"
  ssh-keygen -lf "$scratch/known_hosts" >/dev/null 2>&1 || fail 'Не удалось проверить формат ключа хоста.'
  printf 'Проверяю SSH-доступ пользователя deploy...\n'
  ssh -F /dev/null -i "$key_path" -p "$port" -o IdentitiesOnly=yes -o IdentityAgent=none \
    -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$scratch/known_hosts" -o GlobalKnownHostsFile=/dev/null \
    "deploy@$host" 'test "$(id -un)" = deploy' ||
    fail 'SSH-проверка не прошла. Настройки GitHub не изменены.'

  for component in "${components[@]}"; do
    repository="fedornabilkin/klan-$component"
    # Do not PUT an existing environment: its approval and branch rules must survive.
    if [[ "${existing_environment[$component]}" != yes ]]; then
      gh api --method PUT "repos/$repository/environments/production" >/dev/null ||
        fail "Не удалось создать production в $repository."
    fi
    printf '%s' "$host" | gh secret set DEPLOY_HOST --repo "$repository" --env production
    printf '%s' "$port" | gh secret set DEPLOY_PORT --repo "$repository" --env production
    printf '%s' deploy | gh secret set DEPLOY_USER --repo "$repository" --env production
    gh secret set DEPLOY_SSH_KEY --repo "$repository" --env production < "$key_path"
    gh secret set DEPLOY_KNOWN_HOSTS --repo "$repository" --env production < "$scratch/known_hosts"
    if [[ "$component" == frontend ]]; then
      printf '%s' "$origin" | gh variable set PRODUCTION_URL --repo "$repository" --env production
    fi
    printf 'Настроено окружение production: %s\n' "$repository"
  done
  printf 'GitHub настроен. Деплой запускается после следующего изменения основной ветки.\n'
)

setup_frontend_nginx() (
  set -euo pipefail
  umask 077
  nginx_setup_fail() { printf 'Klan nginx: %s\n' "$1" >&2; exit 1; }
  [[ $EUID == 0 ]] || nginx_setup_fail 'Run the installer with sudo.'
  for utility in nginx "$certbot_command" systemctl flock awk sed cmp install realpath; do
    command -v "$utility" >/dev/null || nginx_setup_fail "Missing tool: $utility"
  done
  # Validated public settings are supplied by the installer's prompt layer.
  # shellcheck disable=SC2154
  local domain="${site_domain,,}" upstream="$api_upstream" upstream_host port
  local http_ipv6='    listen [::]:80;' tls_ipv6='    listen [::]:443 ssl;' tls_default=''
  local -a certificate_args=(--domain "$domain")
  if [[ "$mode" == configure-ip ]]; then
    http_ipv6=''
    tls_ipv6=''
    tls_default=' default_server'
    certificate_args=(--ip-address "$domain" --preferred-profile shortlived)
  fi
  [[ "$domain" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ && "$domain" == *.* && "$domain" != *..* ]] || nginx_setup_fail 'Invalid site domain.'
  [[ "$upstream" =~ ^https?://([A-Za-z0-9][A-Za-z0-9.-]*|\[[A-Fa-f0-9:]+\])(:[0-9]{1,5})?$ ]] || nginx_setup_fail 'API upstream must be an HTTP(S) origin.'
  upstream_host="${upstream#*://}"
  if [[ "$upstream_host" =~ :([0-9]+)$ ]]; then
    port="${BASH_REMATCH[1]}"
    (( 10#$port >= 1 && 10#$port <= 65535 )) || nginx_setup_fail 'Invalid API upstream port.'
    upstream_host="${upstream_host%:*}"
  fi
  upstream_host="${upstream_host#[}"
  upstream_host="${upstream_host%]}"
  if [[ "$upstream" == https://* ]]; then
    [[ -r /etc/ssl/certs/ca-certificates.crt ]] || nginx_setup_fail 'System CA certificates are required for HTTPS upstream verification.'
  fi

  local available=/etc/nginx/sites-available/klan-frontend
  local enabled=/etc/nginx/sites-enabled/klan-frontend
  local acme_root=/var/www/letsencrypt
  local cert_dir="/etc/letsencrypt/live/$domain"
  local hook=/etc/letsencrypt/renewal-hooks/deploy/reload-klan-nginx
  local marker='# Managed by Klan setup-server.sh: frontend v1'
  local work_dir='' changed=0 hook_changed=0 finished=0
  local had_available=0 had_enabled=0 had_hook=0 was_active=0 started=0
  [[ ! -L "$available" && ( ! -e "$available" || -f "$available" ) ]] || nginx_setup_fail 'The Klan nginx configuration must be a regular file.'
  if [[ -L "$enabled" ]]; then
    [[ "$(realpath -m -- "$enabled")" == "$available" ]] || nginx_setup_fail 'sites-enabled/klan-frontend points at an unmanaged configuration.'
    had_enabled=1
  elif [[ -e "$enabled" ]]; then
    nginx_setup_fail 'sites-enabled/klan-frontend must be the managed symlink; existing file was left unchanged.'
  fi
  [[ ! -L "$hook" && ( ! -e "$hook" || -f "$hook" ) ]] || nginx_setup_fail 'The Klan renewal hook must be a regular file.'
  if [[ -e "$cert_dir/fullchain.pem" || -e "$cert_dir/privkey.pem" ]]; then
    [[ -s "$cert_dir/fullchain.pem" && -s "$cert_dir/privkey.pem" ]] || nginx_setup_fail 'Existing certificate is incomplete; inspect its Certbot lineage.'
  else
    [[ "${cert_email:-}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || nginx_setup_fail 'A certificate contact email is required for the first HTTPS setup.'
  fi
  exec 8>/run/klan-nginx-setup.lock || nginx_setup_fail 'Cannot open the setup lock.'
  flock -w 120 8 || nginx_setup_fail 'Another nginx setup is running.'
  install -d -m 0755 /etc/nginx/sites-available /etc/nginx/sites-enabled || nginx_setup_fail 'Cannot prepare nginx configuration directories.'
  work_dir="$(mktemp -d /etc/nginx/.klan-setup-XXXXXX)" || nginx_setup_fail 'Cannot create the nginx setup workspace.'

  # shellcheck disable=SC2329
  nginx_setup_cleanup() {
    local result=$? restored=1
    trap - EXIT INT TERM
    if (( result != 0 && finished == 0 )); then
      if (( changed == 1 )); then
        if (( had_available == 1 )); then
          cp -p -- "$work_dir/original.conf" "$available" || restored=0
        else
          rm -f -- "$available" || restored=0
        fi
        if (( had_enabled == 0 )) && [[ -L "$enabled" ]]; then
          rm -- "$enabled" || restored=0
        fi
      fi
      if (( hook_changed == 1 )); then
        if (( had_hook == 1 )); then cp -p -- "$work_dir/original.hook" "$hook" || restored=0
        else rm -f -- "$hook" || restored=0; fi
      fi
      if (( changed == 1 || started == 1 )); then
        if (( was_active == 1 )); then
          if ! nginx -t || ! systemctl reload nginx; then restored=0; fi
        elif (( started == 1 )); then
          systemctl stop nginx || restored=0
        fi
        if (( restored == 1 )); then printf 'Klan nginx: previous configuration restored.\n' >&2
        else printf 'Klan nginx: restoration failed; inspect the saved configuration in %s.\n' "$work_dir" >&2; fi
      fi
    fi
    if (( restored == 1 )) && [[ "$work_dir" == /etc/nginx/.klan-setup-* && ! -L "$work_dir" ]]; then
      rm -rf -- "$work_dir"
    fi
    exit "$result"
  }
  trap nginx_setup_cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  if systemctl is-active --quiet nginx; then was_active=1; fi
  nginx -t || nginx_setup_fail 'Existing nginx configuration is invalid; nothing was replaced.'
  nginx -T > "$work_dir/before.dump" 2> "$work_dir/before.log" || nginx_setup_fail 'Cannot inspect existing nginx virtual hosts.'
  if [[ "$mode" == configure-ip ]]; then
    local listeners
    listeners=$(ss -H -ltn "sport = :$site_port") || nginx_setup_fail 'Cannot check the HTTPS port.'
    if [[ -n "$listeners" ]]; then
      if (( had_enabled != 1 )) || ! grep -Fxq "$marker" "$available" ||
        ! grep -Fxq "    listen $site_port ssl default_server;" "$available"; then
        nginx_setup_fail "Порт $site_port уже занят. Укажите свободный порт."
      fi
    fi
  fi

  nginx_render_static() {
    local destination_upstream=$1
    cat <<CONFIG
$marker
map \$http_upgrade \$klan_connection_upgrade {
    default upgrade;
    '' close;
}
server {
    listen 80;
$http_ipv6
    server_name $domain;
    location ^~ /.well-known/acme-challenge/ {
        root $acme_root;
    }
    location / {
        return 301 $site_origin\$request_uri;
    }
}
server {
    listen $site_port ssl$tls_default;
$tls_ipv6
    server_name $domain;
    ssl_certificate $cert_dir/fullchain.pem;
    ssl_certificate_key $cert_dir/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 1m;
    root /var/www/klan;
    index index.html;
    location = /internal { return 404; }
    location ^~ /internal/ { return 404; }
    location ~ ^/(api|ws)(/|$) {
        proxy_pass $destination_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$klan_connection_upgrade;
        proxy_read_timeout 3600s;
CONFIG
    if [[ "$destination_upstream" == https://* ]]; then
      cat <<CONFIG
        proxy_ssl_server_name on;
        proxy_ssl_name $upstream_host;
        proxy_ssl_verify on;
        proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
        proxy_ssl_verify_depth 3;
CONFIG
    fi
    cat <<'CONFIG'
    }
    location = /deploy-version.txt {
        add_header Cache-Control "no-store" always;
        try_files $uri =404;
    }
    location = /deploy-site.txt {
        add_header Cache-Control "no-store" always;
        try_files $uri =404;
    }
    location = /index.html {
        add_header Cache-Control "no-cache" always;
        try_files $uri =404;
    }
    location ^~ /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
CONFIG
  }
  nginx_normalize() { sed '/^[[:space:]]*#/d;s/[[:space:]]//g' "$1" | tr -d '\n'; }
  if [[ -f "$available" ]]; then
    had_available=1
    cp -p -- "$available" "$work_dir/original.conf" || nginx_setup_fail 'Cannot save the existing nginx configuration.'
    if ! grep -Fxq "$marker" "$available"; then
      nginx_render_static http://127.0.0.1:3101 > "$work_dir/legacy.conf" || nginx_setup_fail 'Cannot render the legacy configuration comparison.'
      [[ "$(nginx_normalize "$available")" == "$(nginx_normalize "$work_dir/legacy.conf")" ]] ||
        nginx_setup_fail 'Existing klan-frontend is not the managed or official production configuration; it was left unchanged.'
    fi
  fi
  # Detect the exact domain in any other active server_name, including multiline directives.
  awk -v wanted="$domain" -v available="$available" -v enabled="$enabled" '
    /^# configuration file / { file=$0; sub(/^# configuration file /,"",file); sub(/:$/,"",file); names=0; next }
    {
      line=$0; sub(/#.*/,"",line); gsub(/[;{}]/," & ",line);
      count=split(line,words,/[[:space:]]+/);
      for(i=1;i<=count;i++) {
        word=words[i];
        if(word=="server_name") { names=1; continue }
        if(word==";" || word=="{" || word=="}") { names=0; continue }
        gsub(/["\047]/,"",word);
        if(names && tolower(word)==wanted && file!=available && file!=enabled) print file;
      }
    }' "$work_dir/before.dump" > "$work_dir/conflicts" || nginx_setup_fail 'Cannot check nginx domain ownership.'
  [[ ! -s "$work_dir/conflicts" ]] || nginx_setup_fail 'This domain already belongs to another active nginx configuration; no virtual host was replaced.'
  if [[ -f "$hook" ]]; then
    had_hook=1
    cp -p -- "$hook" "$work_dir/original.hook" || nginx_setup_fail 'Cannot save the existing renewal hook.'
    if ! grep -Fxq "$marker" "$hook"; then
      [[ "$(nginx_normalize "$hook")" == 'nginx-t&&systemctlreloadnginx' ]] ||
        nginx_setup_fail 'The existing renewal hook is not managed by Klan; it was left unchanged.'
    fi
  fi

  nginx_apply_candidate() {
    local candidate=$1
    changed=1
    install -m 0644 "$candidate" "$work_dir/installed.conf" || return
    mv -f -- "$work_dir/installed.conf" "$available" || return
    if [[ ! -L "$enabled" ]]; then ln -s "$available" "$enabled" || return; fi
    nginx -t || return
    nginx -T > "$work_dir/candidate.dump" 2> "$work_dir/candidate.log" || return
    if ! grep -Fxq "# configuration file $enabled:" "$work_dir/candidate.dump" &&
      ! grep -Fxq "# configuration file $available:" "$work_dir/candidate.dump"; then
      printf 'Klan nginx: nginx.conf does not include the installed sites-enabled configuration.\n' >&2
      return 1
    fi
    if systemctl is-active --quiet nginx; then
      systemctl reload nginx || return
    else
      systemctl start nginx || return
      started=1
    fi
  }
  install -d -m 0755 "$acme_root/.well-known/acme-challenge" || nginx_setup_fail 'Cannot create the ACME webroot.'
  if [[ ! -s "$cert_dir/fullchain.pem" ]]; then
    cat > "$work_dir/bootstrap.conf" <<CONFIG || nginx_setup_fail 'Cannot write the HTTP bootstrap configuration.'
$marker
server {
    listen 80;
$http_ipv6
    server_name $domain;
    location ^~ /.well-known/acme-challenge/ { root $acme_root; }
    location = /internal { return 404; }
    location ^~ /internal/ { return 404; }
    location / { return 503; }
}
CONFIG
    nginx_apply_candidate "$work_dir/bootstrap.conf" || nginx_setup_fail 'HTTP certificate bootstrap failed.'
    "$certbot_command" certonly --webroot --webroot-path "$acme_root" --cert-name "$domain" \
      "${certificate_args[@]}" --email "$cert_email" --agree-tos --non-interactive --keep-until-expiring ||
      nginx_setup_fail 'Certificate issuance failed. Check that the address reaches this server on TCP 80.'
    [[ -s "$cert_dir/fullchain.pem" && -s "$cert_dir/privkey.pem" ]] || nginx_setup_fail 'Certbot did not create the expected certificate.'
  fi
  nginx_render_static "$upstream" > "$work_dir/production.conf" || nginx_setup_fail 'Cannot write the production configuration.'
  if ! cmp -s "$work_dir/production.conf" "$available" || (( had_enabled == 0 )); then
    nginx_apply_candidate "$work_dir/production.conf" || nginx_setup_fail 'Production nginx configuration failed validation or activation.'
  elif ! systemctl is-active --quiet nginx; then
    systemctl start nginx || nginx_setup_fail 'Cannot start the configured nginx service.'
    started=1
  fi
  printf '#!/bin/sh\n%s\nnginx -t && systemctl reload nginx\n' "$marker" > "$work_dir/renew.hook" || nginx_setup_fail 'Cannot write the certificate renewal hook.'
  if ! cmp -s "$work_dir/renew.hook" "$hook"; then
    hook_changed=1
    install -d -m 0755 "$(dirname "$hook")" || nginx_setup_fail 'Cannot create the renewal hook directory.'
    install -m 0755 "$work_dir/renew.hook" "$hook" || nginx_setup_fail 'Cannot install the renewal hook.'
  fi
  if [[ "$certbot_command" == /snap/bin/certbot ]]; then
    systemctl enable --now snap.certbot.renew.timer || nginx_setup_fail 'Cannot enable automatic certificate renewal.'
  elif systemctl cat certbot.timer >/dev/null 2>&1; then
    systemctl enable --now certbot.timer || nginx_setup_fail 'Cannot enable automatic certificate renewal.'
  elif systemctl cat snap.certbot.renew.timer >/dev/null 2>&1; then
    systemctl enable --now snap.certbot.renew.timer || nginx_setup_fail 'Cannot enable automatic certificate renewal.'
  elif [[ ! -f /etc/cron.d/certbot ]]; then
    nginx_setup_fail 'No automatic Certbot renewal timer or cron entry was found.'
  fi
  if (( changed == 1 && had_available == 1 )); then
    install -d -m 0700 /var/backups/klan-nginx || nginx_setup_fail 'Cannot create the nginx backup directory.'
    install -m 0600 "$work_dir/original.conf" "/var/backups/klan-nginx/klan-frontend-$(date +%Y%m%dT%H%M%S)-$$.conf" || nginx_setup_fail 'Cannot retain the previous nginx configuration.'
  fi
  finished=1
  printf 'Klan nginx: %s serves /var/www/klan; API upstream %s.\n' "$site_origin" "$upstream"
)

is_ipv4() {
  local part
  local -a octets
  [[ "$1" =~ ^(0|[1-9][0-9]{0,2})(\.(0|[1-9][0-9]{0,2})){3}$ ]] || return 1
  IFS=. read -ra octets <<< "$1"
  for part in "${octets[@]}"; do (( part <= 255 )) || return 1; done
}

validate_domain() {
  local label
  local -a labels
  [[ "$1" == *.* && "$1" != *. && ${#1} -le 253 ]] || fail 'Введите полное DNS-имя сайта без https:// и пути.'
  IFS=. read -ra labels <<< "$1"
  for label in "${labels[@]}"; do
    [[ "$label" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'Некорректное DNS-имя.'
  done
}
validate_origin() {
  [[ "$1" =~ ^https?://[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:([1-9][0-9]{0,4}))?$ ]] || fail 'Введите адрес API в виде http(s)://имя[:порт], без пути.'
  local port="${BASH_REMATCH[3]:-80}"
  (( 10#$port <= 65535 )) || fail 'Некорректный порт API.'
}

prepare_site_tools() {
  local -a missing=()
  local version
  command -v curl >/dev/null || missing+=(curl)
  if selected frontend; then
    command -v nginx >/dev/null || missing+=(nginx)
    if [[ "$mode" == configure-domain ]]; then
      command -v certbot >/dev/null || missing+=(certbot)
    else
      command -v ss >/dev/null || missing+=(iproute2)
    fi
    command -v rsync >/dev/null || missing+=(rsync)
  fi
  if selected backend; then
    command -v git >/dev/null || missing+=(git)
    command -v openssl >/dev/null || missing+=(openssl)
    command -v ip >/dev/null || missing+=(iproute2)
  fi
  if (( ${#missing[@]} )); then
    command -v apt-get >/dev/null || fail "Установите пакеты: ${missing[*]}"
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"
  fi
  if selected backend || selected bot; then
    command -v docker >/dev/null || fail 'Для API и бота установите Docker Engine и Docker Compose 2.30+ на этом сервере.'
    version=$(deploy_docker compose version --short) || fail 'Нужен Docker Compose 2.30 или новее.'
    version=${version#v}
    dpkg --compare-versions "$version" ge 2.30.0 || fail 'Нужен Docker Compose 2.30 или новее.'
    if selected bot; then
      [[ $(uname -m) == x86_64 ]] || fail 'Образу бота нужен сервер linux/amd64.'
    fi
  fi
}

# Read/write private deploy-owned files as their owner. Publish complete files atomically.
save_setting() {
  local path=$1
  # Keep the tempfile and cleanup scoped to the unprivileged child shell.
  # shellcheck disable=SC2016
  runuser -u deploy -- bash -eu -c '
    dest=$1
    tmp=$(mktemp -- "$(dirname -- "$dest")/.setup.XXXXXXXX")
    trap '\''rm -f -- "$tmp"'\'' EXIT
    cat > "$tmp"
    chmod 600 "$tmp"
    mv -fT -- "$tmp" "$dest"
  ' _ "$path"
}
restore_runtime() {
  local root=$1 runtime="$1/shared/runtime.env" release
  if [[ -e "$runtime" || -L "$runtime" ]]; then
    [[ -f "$runtime" && ! -L "$runtime" && -s "$runtime" ]] || fail "Проверьте $runtime"
    runuser -u deploy -- test -r "$runtime" || fail "Пользователю deploy нужен доступ к $runtime"
    return
  fi
  if [[ -e "$root/current" || -L "$root/current" ]]; then
    release=$(realpath -e -- "$root/current") || fail "Проверьте $root/current"
    [[ $(dirname -- "$release") == "$root/releases" && -s "$release/runtime.env" && ! -L "$release/runtime.env" ]] ||
      fail "Восстановите действующий runtime.env в $root/shared перед повторным запуском."
    runuser -u deploy -- cat -- "$release/runtime.env" | save_setting "$runtime"
  fi
}
get_value() {
  [[ -f "$1" ]] || return 0
  # The fields in this program belong to awk.
  # shellcheck disable=SC2016
  runuser -u deploy -- awk -v key="$2=" 'index($0,key)==1 {sub(/\r$/,""); print substr($0,length(key)+1); exit}' "$1"
}
read_setting() {
  if [[ -f "$1" && ! -L "$1" ]]; then runuser -u deploy -- cat -- "$1"; fi
}

configure_runtime() {
  local backend=/opt/klan/backend/shared/runtime.env bot=/opt/klan/bot/shared/runtime.env
  local token='' secret='' api_token='' bot_token='' api_secret='' bot_secret='' username groups='' admins password origin mount bind_file bind address url old_url
  local membership_override="${TELEGRAM_REQUIRE_GROUP_MEMBERSHIP:-}"
  [[ -z "$membership_override" || "$membership_override" == true || "$membership_override" == false ]] ||
    fail 'TELEGRAM_REQUIRE_GROUP_MEMBERSHIP принимает true или false.'
  local ids='^-[1-9][0-9]*(,-[1-9][0-9]*)*$' admin_ids='^([1-9][0-9]*(,[1-9][0-9]*)*)?$'
  if selected backend; then
    api_token=$(get_value "$backend" TELEGRAM_BOT_TOKEN)
    api_secret=$(get_value "$backend" BOT_INTERNAL_SECRET)
    if [[ ! -f "$backend" ]]; then
      mount=$(deploy_docker volume inspect --format '{{ .Mountpoint }}' klan-production-postgres)
      [[ -n "$mount" && -d "$mount" ]] || fail 'Не удалось проверить каталог данных PostgreSQL.'
      [[ -z $(find "$mount" -mindepth 1 -maxdepth 1 -print -quit) ]] ||
        fail "У базы уже есть данные. Восстановите её действующий runtime.env в $backend и повторите запуск."
    else
      [[ -n "$api_token" && -n "$api_secret" ]] || fail "Заполните TELEGRAM_BOT_TOKEN и BOT_INTERNAL_SECRET в $backend."
    fi
  fi
  if selected bot; then
    bot_token=$(get_value "$bot" TELEGRAM_BOT_TOKEN)
    bot_secret=$(get_value "$bot" BOT_BACKEND_SECRET)
    if [[ -f "$bot" ]]; then
      [[ -n "$bot_token" && -n "$bot_secret" ]] || fail "Заполните TELEGRAM_BOT_TOKEN и BOT_BACKEND_SECRET в $bot."
    fi
  fi
  [[ -z "$api_token" || -z "$bot_token" || "$api_token" == "$bot_token" ]] || fail 'У API и бота указаны разные токены Telegram. Сверьте файлы shared/runtime.env.'
  [[ -z "$api_secret" || -z "$bot_secret" || "$api_secret" == "$bot_secret" ]] || fail 'У API и бота различаются секреты внутренней связи. Сверьте файлы shared/runtime.env.'
  token=${api_token:-$bot_token}
  secret=${api_secret:-$bot_secret}
  if [[ -z "$token" ]]; then token=$(ask_secret 'Токен Telegram от BotFather'); fi
  [[ "$token" =~ ^[0-9]+:[A-Za-z0-9_-]{20,}$ ]] || fail 'Проверьте формат токена BotFather.'
  if [[ -z "$secret" ]]; then
    if selected backend; then secret=$(openssl rand -hex 32)
    else secret=$(ask_secret 'Действующий BOT_INTERNAL_SECRET с сервера API'); fi
  fi
  local LC_ALL=C
  [[ ${#secret} -ge 32 && ${#secret} -le 256 && "$secret" =~ ^[[:graph:]]+$ ]] ||
    fail 'Для связи API и бота нужен секрет из 32–256 печатных ASCII-символов без пробелов.'

  if selected backend; then
    if [[ ! -f "$backend" ]]; then
      username=$(ask 'Имя бота в Telegram без @' ''); username=${username#@}
      [[ "$username" =~ ^[a-zA-Z0-9_]{5,32}$ ]] || fail 'Проверьте имя бота.'
      if [[ "$membership_override" != false ]]; then
        groups=$(ask 'Числовые ID разрешённых групп Telegram через запятую' '')
        groups=${groups// /}
        [[ "$groups" =~ $ids ]] || fail 'ID групп должны быть отрицательными числами через запятую.'
      fi
      admins=$(ask 'ID администраторов Telegram через запятую (можно оставить пустым)' '')
      admins=${admins// /}
      [[ "$admins" =~ $admin_ids ]] || fail 'ID администраторов должны быть положительными числами через запятую.'
      password=$(openssl rand -hex 32)
      cat <<ENV | save_setting "$backend"
APP_ORIGIN=$site_origin
POSTGRES_DB=klan
POSTGRES_USER=klan
POSTGRES_PASSWORD=$password
DATABASE_URL=postgresql://klan:$password@db:5432/klan
TELEGRAM_BOT_TOKEN=$token
TELEGRAM_BOT_USERNAME=$username
TELEGRAM_REQUIRE_GROUP_MEMBERSHIP=${membership_override:-true}
TELEGRAM_GROUP_IDS=$groups
TELEGRAM_GROUP_LEVELS={}
TELEGRAM_MEMBERSHIP_TTL_SECONDS=60
TELEGRAM_ADMIN_IDS=$admins
BOT_INTERNAL_SECRET=$secret
ENV
    else
      if selected frontend; then
        origin=$(get_value "$backend" APP_ORIGIN)
        [[ "$origin" == "$site_origin" ]] || fail "Установите APP_ORIGIN=$site_origin в $backend."
      fi
      if [[ -n "$membership_override" && "$(get_value "$backend" TELEGRAM_REQUIRE_GROUP_MEMBERSHIP)" != "$membership_override" ]]; then
        if [[ "$membership_override" == true ]]; then
          groups=$(get_value "$backend" TELEGRAM_GROUP_IDS)
          [[ "$groups" =~ $ids ]] || fail "Заполните ID групп в $backend перед включением проверки."
        fi
        runuser -u deploy -- awk -v required="$membership_override" '
          !/^TELEGRAM_REQUIRE_GROUP_MEMBERSHIP=/ {print}
          END {print "TELEGRAM_REQUIRE_GROUP_MEMBERSHIP=" required}
        ' "$backend" | save_setting "$backend"
      fi
    fi
    bind_file=/opt/klan/backend/shared/api-bind-address
    if [[ "$role" == backend ]]; then
      bind=$(read_setting "$bind_file")
      address=$(ask 'IP сервера для API (для удалённых компонентов — адрес его частной сети/VPN)' "${bind:-127.0.0.1}")
      if [[ "$address" != 127.0.0.1 ]]; then
        [[ "$address" =~ ^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.) ]] ||
          fail 'Для другого сервера используйте частный адрес API.'
        ip -o -4 addr show | awk '{split($4, a, "/"); print a[1]}' | grep -Fx -- "$address" >/dev/null ||
          fail 'Введите адрес частной сети 10/8, 172.16/12 или 192.168/16, назначенный этому серверу.'
      fi
      printf '%s\n' "$address" | save_setting "$bind_file"
    fi
  fi
  if selected bot; then
    old_url=$(get_value "$bot" BOT_BACKEND_URL)
    url=${old_url:-http://api:3001}
    if [[ "$role" == bot ]]; then
      url=$(ask 'Адрес API для бота (на этом сервере http://api:3001, на другом — адрес в частной сети)' "$old_url")
    fi
    validate_origin "$url"
    if [[ ! -f "$bot" ]]; then
      printf 'TELEGRAM_BOT_TOKEN=%s\nBOT_BACKEND_SECRET=%s\nBOT_BACKEND_URL=%s\n' "$token" "$secret" "$url" | save_setting "$bot"
    elif [[ "$old_url" != "$url" ]]; then
      runuser -u deploy -- awk -v url="$url" '!/^BOT_BACKEND_URL=/{print} END {print "BOT_BACKEND_URL=" url}' "$bot" | save_setting "$bot"
    fi
  fi
}

ip_certbot_command() {
  local candidate output version
  for candidate in /snap/bin/certbot certbot; do
    output=$("$candidate" --version 2>/dev/null) || continue
    [[ "$output" =~ ^certbot[[:space:]]+([0-9]+\.[0-9]+\.[0-9]+) ]] || continue
    version=${BASH_REMATCH[1]}
    if dpkg --compare-versions "$version" ge 5.4.0; then
      printf '%s\n' "$candidate"
      return
    fi
  done
  return 1
}

configure_site() {
  prepare_site_tools
  local component
  for component in backend bot; do
    if selected "$component"; then restore_runtime "/opt/klan/$component"; fi
  done
  local site_domain='' site_origin='' site_port=443 api_upstream='' cert_email='' certbot_command=certbot
  local previous_domain='' previous_origin='' origin='' saved address_default port_default
  if selected frontend; then
    previous_domain=$(read_setting /opt/klan/frontend/shared/site-domain)
    previous_origin=$(read_setting /opt/klan/frontend/shared/site-origin)
    if [[ "$mode" == configure-ip ]] && ! certbot_command=$(ip_certbot_command); then
      command -v snap >/dev/null || fail 'Установите Certbot 5.4+ для сертификата на IP и повторите команду.'
      snap install --classic certbot
      certbot_command=$(ip_certbot_command) || fail 'После установки не найден Certbot 5.4+.'
    fi
  fi
  if selected backend; then origin=$(get_value /opt/klan/backend/shared/runtime.env APP_ORIGIN); fi
  if selected frontend || { selected backend && [[ -z "$origin" ]]; }; then
    if [[ "$mode" == configure-ip ]]; then
      saved=${previous_origin:-$origin}
      saved=${saved#https://}
      address_default=${saved%%:*}
      port_default=8443
      if ! is_ipv4 "$address_default"; then address_default=''; fi
      if [[ -n "$address_default" && "$saved" == *:* ]]; then port_default=${saved##*:}; fi
      site_domain=$(ask 'Публичный IPv4 сайта' "$address_default")
      is_ipv4 "$site_domain" || fail 'Введите публичный IPv4.'
      site_port=$(ask 'HTTPS-порт сайта' "$port_default")
      if [[ ! "$site_port" =~ ^[1-9][0-9]{3,4}$ ]] || (( site_port < 1024 || site_port > 65535 || site_port == 3101 )); then
        fail 'Выберите свободный порт от 1024 до 65535. Порт 3101 используется API.'
      fi
      site_origin="https://$site_domain:$site_port"
    else
      site_domain=$(ask 'Домен сайта Клана' "${previous_domain:-${origin#https://}}")
      site_domain=${site_domain,,}
      validate_domain "$site_domain"
      site_origin="https://$site_domain"
    fi
  fi
  if selected backend || selected bot; then configure_runtime; fi
  if selected frontend; then
    saved=$(read_setting /opt/klan/frontend/shared/api-upstream)
    api_upstream=${saved:-http://127.0.0.1:3101}
    if [[ "$role" == frontend ]]; then api_upstream=$(ask 'Адрес API для nginx' "$api_upstream"); fi
    validate_origin "$api_upstream"
    if [[ ! -s "/etc/letsencrypt/live/$site_domain/fullchain.pem" ]]; then
      cert_email=$(ask 'Электронная почта для сертификата HTTPS' '')
      [[ "$cert_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail 'Введите email для сертификата.'
    fi
    setup_frontend_nginx
    printf '%s\n' "$site_domain" | save_setting /opt/klan/frontend/shared/site-domain
    printf '%s\n' "$site_origin" | save_setting /opt/klan/frontend/shared/site-origin
    printf '%s\n' "$api_upstream" | save_setting /opt/klan/frontend/shared/api-upstream
  fi
  printf '\nСервер готов. Для настройки GitHub на своём компьютере запустите: bash setup-deployment.sh github %s\n' "$role"
  local host_key
  for host_key in /etc/ssh/ssh_host_{ed25519,ecdsa,rsa}_key.pub; do
    if [[ -s "$host_key" ]]; then
      printf 'Публичный ключ хоста для этого шага:\n'
      awk 'NR==1 {print $1, $2}' "$host_key"
      break
    fi
  done
}

usage() {
  printf '%s\n' 'sudo bash setup-deployment.sh configure-ip [all|frontend|backend|bot]' \
    'sudo bash setup-deployment.sh configure-domain [all|frontend|backend|bot]' \
    'bash setup-deployment.sh github [all|frontend|backend|bot]'
}
case "${1:-}" in
  --help|-h) usage; exit 0 ;;
  github|configure-domain|configure-ip) mode=$1; shift ;;
  *) usage >&2; exit 2 ;;
esac
(( $# <= 1 )) || { usage >&2; exit 2; }
role=${1:-all}
case "$role" in all|frontend|backend|bot) ;; *) usage >&2; exit 2 ;; esac
case "$mode" in
  configure-domain|configure-ip) setup_server; configure_site ;;
  github) setup_github ;;
esac
