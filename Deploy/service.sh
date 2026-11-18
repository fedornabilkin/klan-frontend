#!/usr/bin/env bash
# Sourced by server-release.sh; compose() selects this release and its fixed project.

service_preflight() {
  compose run --rm --no-deps --entrypoint caddy frontend validate \
    --config /etc/caddy/Caddyfile --adapter caddyfile || return
}

service_start() {
  compose up -d --no-build --wait --wait-timeout 120 frontend || return
}

service_verify() {
  local path page status
  for path in / /users/1; do
    page=$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
      "http://127.0.0.1:8088${path}") || return
    if [[ "$page" != *'id="app"'* ]]; then
      printf 'Frontend verification failed: %s did not return the application.\n' "$path" >&2
      return 1
    fi
  done
  for path in /internal /internal/health; do
    status=$(curl --silent --show-error --connect-timeout 5 --max-time 15 \
      --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:8088${path}") || return
    if [[ "$status" != 404 ]]; then
      printf 'Frontend verification failed: %s returned HTTP %s, expected 404.\n' "$path" "$status" >&2
      return 1
    fi
  done
}

service_stop() {
  compose stop --timeout 30 frontend || return
}
