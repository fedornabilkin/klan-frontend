#!/usr/bin/env bash
# Prepare the server directories and persistent Docker resources.

fail() { printf '%s\n' "$1" >&2; exit 1; }
selected() { [[ "$role" == all || "$role" == "$1" ]]; }
deploy_docker() { runuser -u deploy -- docker "$@"; }

managed_dir() {
  [[ $(realpath -m -- "$3") == "$3" && ! -L "$3" ]] || fail "Некорректный путь: $3"
  install -d -m "$1" -o "$2" -g "$(id -gn "$2")" -- "$3"
}

prepare_paths() {
  local component volume
  managed_dir 0755 root /opt/klan
  for component in backend frontend bot; do
    selected "$component" || continue
    managed_dir 0700 deploy "/opt/klan/$component"
    managed_dir 0700 deploy "/opt/klan/$component/releases"
    managed_dir 0700 deploy "/opt/klan/$component/shared"
    if [[ "$component" != bot ]]; then managed_dir 0700 deploy "/opt/klan/$component/incoming"; fi
    if [[ "$component" == backend ]]; then managed_dir 0700 deploy /opt/klan/backend/backups; fi
  done
  if selected frontend; then managed_dir 0755 deploy /var/www/klan; fi
  if selected backend || selected bot; then
    deploy_docker network inspect klan-production >/dev/null 2>&1 || deploy_docker network create klan-production >/dev/null
    for component in backend bot; do
      selected "$component" || continue
      if [[ "$component" == backend ]]; then volume=klan-production-postgres; else volume=klan-production-bot-state; fi
      deploy_docker volume inspect "$volume" >/dev/null 2>&1 || deploy_docker volume create "$volume" >/dev/null
    done
  fi
}

setup_server() {
  [[ $EUID == 0 ]] || fail 'На сервере запустите скрипт через sudo.'
  id deploy >/dev/null 2>&1 || fail 'На сервере нужен существующий пользователь deploy.'
  exec 8>/run/klan-setup.lock
  flock -n 8 || fail 'Уже запущена другая настройка Клана.'
  if selected backend || selected bot; then
    deploy_docker info >/dev/null || fail 'Для подготовки хранилищ нужен работающий Docker с доступом для пользователя deploy.'
  fi
  prepare_paths
  printf 'Каталоги и права для deploy подготовлены в /opt/klan.\n'
  if selected frontend; then printf 'Каталог статики: /var/www/klan.\n'; fi
  if selected backend || selected bot; then printf 'Сеть klan-production и тома выбранных компонентов готовы.\n'; fi
}

usage() {
  printf '%s\n' 'sudo bash setup-server.sh [all|frontend|backend|bot]' \
    'По умолчанию готовятся все три компонента. Нужен существующий пользователь deploy.'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  umask 077
  (( $# <= 1 )) || { usage >&2; exit 2; }
  role=${1:-all}
  case "$role" in
    -h|--help) usage; exit 0 ;;
    deploy) role=all ;;
    all|frontend|backend|bot) ;;
    *) usage >&2; exit 2 ;;
  esac
  setup_server
fi
