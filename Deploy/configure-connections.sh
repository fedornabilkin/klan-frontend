#!/usr/bin/env bash
# Run once on the shared Debian/Ubuntu nginx host, independently of site releases.
set -euo pipefail
umask 077
config=/etc/nginx/nginx.conf
[[ $EUID == 0 && -f "$config" && ! -L "$config" ]] || { echo 'Run as root on the nginx host.' >&2; exit 1; }
exec 9>/run/lock/klan-nginx-capacity.lock
flock -w 30 9
systemctl is-active --quiet nginx
nginx -t -c "$config"
candidate=$(mktemp "${config}.klan.XXXXXXXX")
backup=''
restore=0
cleanup() {
  local result=$?
  trap - EXIT INT TERM
  if (( restore )); then
    if ! mv -fT -- "$backup" "$config"; then echo "Could not restore nginx.conf. Backup: $backup" >&2; exit 1; fi
    systemctl reload nginx || { echo 'Check nginx after failed reload.' >&2; result=1; }
  fi
  rm -f -- "$candidate"
  if [[ -n "$backup" ]]; then rm -f -- "$backup"; fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cp -p -- "$config" "$candidate"
awk '
  /^[[:space:]]*worker_connections[[:space:]]+[0-9]+[[:space:]]*;[[:space:]]*(#.*)?$/ {
    connections++
    if ($2+0 < 4096) sub(/[0-9]+/, "4096")
  }
  /^[[:space:]]*worker_rlimit_nofile[[:space:]]+[0-9]+[[:space:]]*;[[:space:]]*(#.*)?$/ {
    limits++
    if ($2+0 < 8192) sub(/[0-9]+/, "8192")
  }
  { print }
  END {
    if (connections != 1 || limits > 1) {
      print "Expected a single worker_connections directive in nginx.conf." > "/dev/stderr"
      exit 1
    }
    if (!limits) print "worker_rlimit_nofile 8192;"
  }
' "$config" > "$candidate"
if cmp -s -- "$config" "$candidate"; then echo 'nginx connection limits are already sufficient.'; exit 0; fi
nginx -t -c "$candidate"
backup=$(mktemp "${config}.before-klan.XXXXXXXX")
cp -p -- "$config" "$backup"
restore=1
mv -fT -- "$candidate" "$config"
systemctl reload nginx
restore=0
echo 'nginx reloaded with capacity for at least 4096 connections per worker.'
