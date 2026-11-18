#!/usr/bin/env bash
# SSH commands expand only settings validated below.
# shellcheck disable=SC2029
set -euo pipefail
umask 077

fail() { printf '%s\n' "$1" >&2; exit 1; }
for name in DEPLOY_HOST DEPLOY_PORT DEPLOY_USER DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS PRODUCTION_URL GITHUB_SHA GITHUB_RUN_ID GITHUB_RUN_ATTEMPT; do
  [[ -n "${!name:-}" ]] || fail "Missing setting: $name"
done
[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || fail 'Invalid SSH host'
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || fail 'Invalid SSH user'
[[ "$DEPLOY_PORT" =~ ^[0-9]{1,5}$ ]] || fail 'Invalid SSH port'
(( 10#$DEPLOY_PORT >= 1 && 10#$DEPLOY_PORT <= 65535 )) || fail 'Invalid SSH port'
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]] || fail 'Invalid commit'
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]] || fail 'Invalid run'
[[ "$PRODUCTION_URL" =~ ^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?/?$ ]] || fail 'PRODUCTION_URL must be an HTTPS origin'
target_origin="${PRODUCTION_URL%/}"
authority="${target_origin#https://}"
if [[ "$authority" == *:* ]]; then
  port="${authority##*:}"
  (( 10#$port >= 1 && 10#$port <= 65535 )) || fail 'Invalid production URL port'
fi
[[ $# == 1 ]] || fail 'Usage: deploy.sh ARTIFACT_DIR'
artifact_dir="$(realpath -- "$1")"
for file in frontend.tar.gz frontend.tar.gz.sha256; do
  [[ -f "$artifact_dir/$file" && ! -L "$artifact_dir/$file" ]] || fail 'Missing release artifact'
done
expected="$(cat "$artifact_dir/frontend.tar.gz.sha256")"
[[ "$expected" =~ ^[a-f0-9]{64}$ ]] || fail 'Invalid release checksum'
actual="$(sha256sum "$artifact_dir/frontend.tar.gz")"
[[ "${actual%% *}" == "$expected" ]] || fail 'Release checksum mismatch'

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
deploy_root=/opt/klan/frontend
release_id="$GITHUB_SHA-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
remote="$deploy_root/incoming/$release_id"
scratch="$(mktemp -d)"
cleanup() { rm -rf -- "$scratch"; }
trap cleanup EXIT
mkdir -p "$scratch/payload/Deploy"
printf '%s\n' "$DEPLOY_SSH_KEY" | tr -d '\r' > "$scratch/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" | tr -d '\r' > "$scratch/known_hosts"
printf '%s\n' "$target_origin" > "$scratch/payload/production-url"
printf '%s\n' "$GITHUB_SHA" > "$scratch/payload/commit"
cp "$artifact_dir/frontend.tar.gz" "$artifact_dir/frontend.tar.gz.sha256" "$scratch/payload/"
cp "$repo_dir/Deploy/server-release.sh" "$scratch/payload/Deploy/"
chmod 600 "$scratch/key" "$scratch/known_hosts"
ssh_options=(-i "$scratch/key" -p "$DEPLOY_PORT" -o IdentitiesOnly=yes -o IdentityAgent=none
  -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$scratch/known_hosts")
ssh "${ssh_options[@]}" "$DEPLOY_USER@$DEPLOY_HOST" \
  "test \"\$(realpath '$deploy_root')\" = '$deploy_root' && test -w '$deploy_root/incoming' && umask 077 && mkdir '$remote' && test \"\$(realpath '$remote')\" = '$remote'"
tar -C "$scratch/payload" -cf - . | ssh "${ssh_options[@]}" "$DEPLOY_USER@$DEPLOY_HOST" \
  "umask 077; tar -xf - -C '$remote' && bash '$remote/Deploy/server-release.sh' deploy"
