#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/../Deploy/service.sh"

calls=()
compose_status=0
scenario=ok
compose() {
  calls+=("$*")
  return "$compose_status"
}
curl() {
  local url=${!#}
  case "$scenario:$url" in
    unavailable:*) return 7 ;;
    broken-root:http://127.0.0.1:8088/) printf 'Unexpected upstream page' ;;
    broken-route:http://127.0.0.1:8088/users/1) return 22 ;;
    exposed-internal:http://127.0.0.1:8088/internal) printf 200 ;;
    exposed-child:http://127.0.0.1:8088/internal/health) printf 200 ;;
    *:http://127.0.0.1:8088/internal*) printf 404 ;;
    *) printf '<html><div id="app"></div></html>' ;;
  esac
}
expect_failure() {
  if "$@"; then
    printf 'Expected failure: %s (scenario %s)\n' "$*" "$scenario" >&2
    exit 1
  fi
}

service_preflight
[[ ${calls[0]} == 'run --rm --no-deps --entrypoint caddy frontend validate --config /etc/caddy/Caddyfile --adapter caddyfile' ]]
service_start
[[ ${calls[1]} == 'up -d --no-build --wait --wait-timeout 120 frontend' ]]
service_stop
[[ ${calls[2]} == 'stop --timeout 30 frontend' ]]
compose_status=19
expect_failure service_preflight
expect_failure service_start
expect_failure service_stop
service_verify
for scenario in unavailable broken-root broken-route exposed-internal exposed-child; do
  expect_failure service_verify
done
printf 'Frontend deployment hooks passed: lifecycle, failures, SPA and internal routes.\n'
