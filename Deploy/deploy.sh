#!/usr/bin/env bash
# SSH commands expand only values validated below.
# shellcheck disable=SC2029
set -euo pipefail
umask 077

fail() { printf '%s\n' "$1" >&2; exit 1; }
for name in DEPLOY_HOST DEPLOY_PORT DEPLOY_USER DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS PRODUCTION_ENV KLAN_COMPONENT IMAGE_REF GITHUB_SHA GITHUB_RUN_ID GITHUB_RUN_ATTEMPT GITHUB_ACTOR GHCR_TOKEN; do
  [[ -n "${!name:-}" ]] || fail "Missing setting: $name"
done
[[ "$KLAN_COMPONENT" =~ ^(frontend|backend|bot)$ ]] || fail 'Invalid component'
[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || fail 'Invalid SSH host'
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || fail 'Invalid SSH user'
[[ "$DEPLOY_PORT" =~ ^[0-9]{1,5}$ ]] || fail 'Invalid SSH port'
(( 10#$DEPLOY_PORT >= 1 && 10#$DEPLOY_PORT <= 65535 )) || fail 'Invalid SSH port'
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]] || fail 'Invalid commit'
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]] || fail 'Invalid run'
[[ "$GITHUB_ACTOR" =~ ^[A-Za-z0-9_-]+(\[bot\])?$ ]] || fail 'Invalid registry user'
[[ "$IMAGE_REF" =~ ^ghcr\.io/[a-z0-9_-]+/klan-$KLAN_COMPONENT@sha256:[a-f0-9]{64}$ ]] || fail 'Expected an immutable Klan image digest'

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
deploy_root="/opt/klan/$KLAN_COMPONENT"
release_id="$GITHUB_SHA-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
remote="$deploy_root/releases/$release_id"
scratch="$(mktemp -d)"
cleanup() { rm -rf -- "$scratch"; }
trap cleanup EXIT
mkdir -p "$scratch/payload/Docker" "$scratch/payload/Deploy"
printf '%s\n' "$DEPLOY_SSH_KEY" | tr -d '\r' > "$scratch/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" | tr -d '\r' > "$scratch/known_hosts"
printf '%s\n' "$PRODUCTION_ENV" | tr -d '\r' > "$scratch/payload/runtime.env"
printf '%s\n' "$IMAGE_REF" > "$scratch/payload/image-ref"
printf '%s\n' "$GITHUB_SHA" > "$scratch/payload/commit"
cp "$repo_dir/Docker/compose.production.yaml" "$scratch/payload/Docker/"
cp "$repo_dir/Deploy/server-release.sh" "$repo_dir/Deploy/service.sh" "$scratch/payload/Deploy/"
chmod 600 "$scratch/key" "$scratch/known_hosts" "$scratch/payload/runtime.env"
ssh_options=(-i "$scratch/key" -p "$DEPLOY_PORT" -o IdentitiesOnly=yes -o IdentityAgent=none
  -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$scratch/known_hosts")
ssh "${ssh_options[@]}" "$DEPLOY_USER@$DEPLOY_HOST" \
  "test \"\$(realpath '$deploy_root')\" = '$deploy_root' && test -w '$deploy_root/releases' && umask 077 && mkdir '$remote' && test \"\$(realpath '$remote')\" = '$remote'"
tar -C "$scratch/payload" -cf - . | ssh "${ssh_options[@]}" "$DEPLOY_USER@$DEPLOY_HOST" \
  "umask 077; tar -xf - -C '$remote'"
# The short-lived token goes through stdin, never an SSH argument or saved config.
printf '%s\n' "$GHCR_TOKEN" | ssh "${ssh_options[@]}" "$DEPLOY_USER@$DEPLOY_HOST" \
  "bash '$remote/Deploy/server-release.sh' deploy '$GITHUB_ACTOR'"
