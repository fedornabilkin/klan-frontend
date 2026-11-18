#!/usr/bin/env bash
set -euo pipefail
umask 077

fail() { printf '%s\n' "$1" >&2; exit 1; }
script_path="$(realpath -- "${BASH_SOURCE[0]}")"
release_dir="$(dirname -- "$(dirname -- "$script_path")")"
deploy_root="$(dirname -- "$(dirname -- "$release_dir")")"
component="$(basename -- "$deploy_root")"
[[ "$component" =~ ^(frontend|backend|bot)$ ]] || fail 'Invalid component directory'
[[ "$deploy_root" == "/opt/klan/$component" ]] || fail 'Expected /opt/klan/<component>'
release_pattern='^[a-f0-9]{40}-[0-9]+-[0-9]+$'
valid_release() {
  [[ "$(dirname -- "$1")" == "$deploy_root/releases" && "$(basename -- "$1")" =~ $release_pattern ]] &&
    [[ "$(realpath -- "$1")" == "$1" ]]
}
valid_release "$release_dir" || fail 'Invalid release directory'
operation="${1:-}"
[[ "$operation" == deploy || "$operation" == rollback ]] || fail 'Usage: server-release.sh deploy REGISTRY_USER | rollback'
for command in docker flock curl; do command -v "$command" >/dev/null || fail "Missing command: $command"; done
version="$(docker compose version --short)"
version="${version#v}"
[[ "$(printf '%s\n' 2.30.0 "$version" | sort -V | head -n 1)" == 2.30.0 ]] || fail 'Docker Compose >=2.30.0 is required'
exec 9>"$deploy_root/.deploy.lock"
flock -w 600 9 || fail 'Another deployment is running'

previous_release=''
if [[ -L "$deploy_root/current" ]]; then
  previous_release="$(realpath -- "$deploy_root/current")"
  valid_release "$previous_release" || fail 'Invalid current release'
elif [[ -e "$deploy_root/current" ]]; then
  fail 'current must be a managed symlink'
fi
if [[ "$operation" == rollback ]]; then
  [[ -L "$deploy_root/previous" ]] || fail 'No previous release is available'
  release_dir="$(realpath -- "$deploy_root/previous")"
  valid_release "$release_dir" || fail 'Invalid previous release'
fi

compose() {
  docker compose --project-name "klan-$component-production" --project-directory "$release_dir/Docker" \
    --env-file /dev/null -f "$release_dir/Docker/compose.production.yaml" "$@"
}
select_release() {
  release_dir="$1"
  valid_release "$release_dir" || return 1
  [[ -f "$release_dir/runtime.env" && ! -L "$release_dir/runtime.env" ]] || return 1
  IMAGE_REF="$(cat -- "$release_dir/image-ref")" || return
  [[ "$IMAGE_REF" =~ ^ghcr\.io/[a-z0-9_-]+/klan-$component@sha256:[a-f0-9]{64}$ ]] || return 1
  export IMAGE_REF
  cd -- "$release_dir" || return
  # Each repository owns these service hooks; the release archive is trusted code.
  # shellcheck disable=SC1091
  source "$release_dir/Deploy/service.sh" || return
}

docker_config=''
changed=0
finished=0
cleanup() {
  result=$?
  trap - EXIT INT TERM
  if (( result != 0 && changed == 1 && finished == 0 )); then
    printf 'Release failed; stopping the failed service.\n' >&2
    if service_stop; then
      if [[ -n "$previous_release" ]]; then
        printf 'Restoring the previous release.\n' >&2
        if select_release "$previous_release" && docker image inspect "$IMAGE_REF" >/dev/null 2>&1 && service_start && service_verify; then
          printf 'Previous release restored.\n' >&2
        else
          printf 'ROLLBACK FAILED: inspect the service before retrying.\n' >&2
        fi
      else
        printf 'First deployment failed; service stopped, persistent data retained.\n' >&2
      fi
    else
      printf 'Could not stop the failed service; automatic rollback was not started.\n' >&2
    fi
  fi
  [[ -z "$docker_config" ]] || rm -rf -- "$docker_config"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
select_release "$release_dir" || fail 'Invalid release metadata'
if [[ "$operation" == deploy ]]; then
  registry_user="${2:-}"
  [[ "$registry_user" =~ ^[A-Za-z0-9_-]+(\[bot\])?$ ]] || fail 'Invalid registry user'
  IFS= read -r registry_token || fail 'Missing registry token on stdin'
  [[ -n "$registry_token" ]] || fail 'Empty registry token'
  docker_config="$(mktemp -d "$deploy_root/.docker-XXXXXX")"
  export DOCKER_CONFIG="$docker_config"
  printf '%s\n' "$registry_token" | docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null
  unset registry_token
  docker pull "$IMAGE_REF"
else
  docker image inspect "$IMAGE_REF" >/dev/null || fail 'Previous image is not available locally'
fi
service_preflight
compose config --quiet
changed=1
service_start
service_verify

# A signal must not restore containers after current already points at this release.
# Finish the short metadata commit before handling process termination again.
trap '' INT TERM
if [[ -n "$previous_release" && "$previous_release" != "$release_dir" ]]; then
  ln -s "releases/$(basename -- "$previous_release")" "$deploy_root/.previous-$$"
  mv -Tf "$deploy_root/.previous-$$" "$deploy_root/previous"
fi
ln -s "releases/$(basename -- "$release_dir")" "$deploy_root/.current-$$"
mv -Tf "$deploy_root/.current-$$" "$deploy_root/current"
finished=1
trap 'exit 130' INT
trap 'exit 143' TERM
printf 'Production %s is running release %s\n' "$component" "$(basename -- "$release_dir")"
