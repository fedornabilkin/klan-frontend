#!/usr/bin/env bash
set -euo pipefail
umask 077

fail() { printf '%s\n' "$1" >&2; exit 1; }
deploy_root=/opt/klan/frontend
web_root=/var/www/klan
script_path="$(realpath -- "${BASH_SOURCE[0]}")"
package_dir="$(dirname -- "$(dirname -- "$script_path")")"
operation="${1:-}"
[[ "$operation" == deploy || "$operation" == rollback ]] || fail 'Usage: server-release.sh deploy | rollback'
for command in curl find flock grep realpath rsync sha256sum tar; do
  command -v "$command" >/dev/null || fail "Missing command: $command"
done
[[ "$(realpath -- "$deploy_root")" == "$deploy_root" ]] || fail 'Unexpected deployment root'
[[ "$(realpath -- "$web_root")" == "$web_root" && -d "$web_root" && -w "$web_root" ]] || fail 'Expected a writable, real /var/www/klan directory'
[[ ! -e "$web_root/.git" && ! -e "$web_root/Project" && ! -e "$web_root/package.json" ]] || fail 'Web root must contain static files, not a source checkout'
[[ "$(realpath -- "$deploy_root/releases")" == "$deploy_root/releases" ]] || fail 'Unexpected releases directory'
exec 9>"$deploy_root/.static-deploy.lock"
flock -w 600 9 || fail 'Another frontend deployment is running'
release_pattern='^([a-f0-9]{40}-[0-9]+-[0-9]+|bootstrap-[0-9]+-[0-9]+)$'

valid_origin() {
  [[ "$1" =~ ^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?$ ]] || return 1
  local authority="${1#https://}" port
  if [[ "$authority" == *:* ]]; then
    port="${authority##*:}"
    (( 10#$port >= 1 && 10#$port <= 65535 )) || return 1
  fi
}
valid_release() {
  local candidate=$1 kind
  [[ "$(dirname -- "$candidate")" == "$deploy_root/releases" && "$(basename -- "$candidate")" =~ $release_pattern ]] || return 1
  [[ "$(realpath -- "$candidate")" == "$candidate" && -d "$candidate/public" && ! -L "$candidate/public" ]] || return 1
  [[ -f "$candidate/kind" && ! -L "$candidate/kind" && -f "$candidate/production-url" && ! -L "$candidate/production-url" ]] || return 1
  kind="$(cat "$candidate/kind")" || return
  [[ "$kind" == static || "$kind" == bootstrap ]] || return 1
  valid_origin "$(cat "$candidate/production-url")" || return
  [[ -z "$(find "$candidate/public" ! -type f ! -type d -print -quit)" ]] || return 1
  if [[ "$kind" == static ]]; then
    local sha
    sha="$(cat "$candidate/commit")" || return
    [[ "$sha" =~ ^[a-f0-9]{40}$ && "$(basename -- "$candidate")" == "$sha-"* ]] || return 1
    [[ -f "$candidate/public/index.html" ]] || return 1
    [[ "$(cat "$candidate/public/deploy-version.txt")" == "$sha" ]] || return 1
    [[ "$(cat "$candidate/public/deploy-site.txt")" == klan-frontend ]] || return 1
  fi
}
read_link() {
  local name=$1
  if [[ -L "$deploy_root/$name" ]]; then
    local resolved
    resolved="$(realpath -- "$deploy_root/$name")" || return
    valid_release "$resolved" || return
    printf '%s\n' "$resolved"
  elif [[ -e "$deploy_root/$name" ]]; then
    return 1
  fi
}
set_link() {
  local name=$1 target=$2 temporary="$deploy_root/.$1-$$"
  if [[ -z "$target" ]]; then
    [[ ! -e "$deploy_root/$name" && ! -L "$deploy_root/$name" ]] || rm -- "$deploy_root/$name" || return
    return 0
  fi
  valid_release "$target" || return
  ln -s "releases/$(basename -- "$target")" "$temporary" || return
  if ! mv -Tf -- "$temporary" "$deploy_root/$name"; then
    rm -- "$temporary"
    return 1
  fi
}
publish_release() {
  valid_release "$1" || return
  # Only public/ is copied. Deployment scripts, archives and historic runtime.env stay private.
  rsync --archive --checksum --delete-after --delay-updates --exclude='.well-known/' \
    --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r "$1/public/" "$web_root/" || return
}
verify_release() {
  local candidate=$1 kind origin expected sha temporary body_hash path differences
  valid_release "$candidate" || return
  kind="$(cat "$candidate/kind")" || return
  origin="$(cat "$candidate/production-url")" || return
  temporary="$(mktemp "$deploy_root/.static-http-XXXXXX")" || return
  if [[ "$kind" == static ]]; then
    sha="$(cat "$candidate/commit")" || return
    for path in deploy-site.txt deploy-version.txt; do
      expected=klan-frontend
      [[ "$path" != deploy-version.txt ]] || expected="$sha"
      if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 20 \
        --retry 2 --retry-delay 1 --output "$temporary" "$origin/$path?release=$(basename -- "$candidate")"; then
        rm -- "$temporary"
        return 1
      fi
      if [[ "$(cat "$temporary")" != "$expected" ]]; then
        printf 'Published frontend %s does not match this release.\n' "$path" >&2
        rm -- "$temporary"
        return 1
      fi
    done
  fi
  if [[ -f "$candidate/public/index.html" ]]; then
    expected="$(sha256sum "$candidate/public/index.html")" || return
    expected="${expected%% *}"
    for path in / /users/1; do
      if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 20 \
        --retry 2 --retry-delay 1 --output "$temporary" "$origin$path?release=$(basename -- "$candidate")"; then
        rm -- "$temporary"
        return 1
      fi
      body_hash="$(sha256sum "$temporary")" || return
      if [[ "${body_hash%% *}" != "$expected" ]]; then
        printf 'Published frontend %s does not match index.html.\n' "$path" >&2
        rm -- "$temporary"
        return 1
      fi
      [[ "$kind" != bootstrap ]] || break
    done
  else
    # An initially empty site has no HTTP document to verify; compare its restored files.
    differences="$(rsync --recursive --checksum --dry-run --itemize-changes --delete \
      --exclude='.well-known/' "$candidate/public/" "$web_root/")" || { rm -- "$temporary"; return 1; }
    if [[ -n "$differences" ]]; then
      printf 'Initial frontend files were not restored.\n' >&2
      rm -- "$temporary"
      return 1
    fi
  fi
  rm -- "$temporary" || return
}
original_current="$(read_link static-current)" || fail 'Invalid static-current release'
original_previous="$(read_link static-previous)" || fail 'Invalid static-previous release'

if [[ "$operation" == deploy ]]; then
  release_id="$(basename -- "$package_dir")"
  [[ "$release_id" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ && "$package_dir" == "$deploy_root/incoming/$release_id" ]] || fail 'Invalid incoming release'
  [[ "$(realpath -- "$package_dir")" == "$package_dir" ]] || fail 'Incoming release must not be a symlink'
  sha="$(cat "$package_dir/commit")"
  [[ "$sha" =~ ^[a-f0-9]{40}$ && "$release_id" == "$sha-"* ]] || fail 'Invalid commit'
  origin="$(cat "$package_dir/production-url")"
  valid_origin "$origin" || fail 'Invalid production origin'
  for file in frontend.tar.gz frontend.tar.gz.sha256; do
    [[ -f "$package_dir/$file" && ! -L "$package_dir/$file" ]] || fail 'Invalid release archive'
  done
  expected="$(cat "$package_dir/frontend.tar.gz.sha256")"
  [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || fail 'Invalid archive checksum'
  actual="$(sha256sum "$package_dir/frontend.tar.gz")"
  [[ "${actual%% *}" == "$expected" ]] || fail 'Archive checksum mismatch'
  tar -tzf "$package_dir/frontend.tar.gz" > "$package_dir/archive-paths"
  while IFS= read -r entry; do
    [[ "$entry" != . && "$entry" != ./ ]] || continue
    entry="${entry#./}"
    [[ "$entry" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ && ! "$entry" =~ (^|/)\.\.?(/|$) && ! "$entry" =~ (^|/)\. ]] || fail 'Archive contains an unsafe path'
  done < "$package_dir/archive-paths"
  tar -tvzf "$package_dir/frontend.tar.gz" > "$package_dir/archive-types"
  while IFS= read -r entry; do
    [[ "${entry:0:1}" == - || "${entry:0:1}" == d ]] || fail 'Archive contains a link or special file'
  done < "$package_dir/archive-types"
  release_dir="$deploy_root/releases/$release_id"
  [[ ! -e "$release_dir" && ! -L "$release_dir" ]] || fail 'Release directory already exists; rerun the workflow with a new attempt'
  mkdir -p "$release_dir/public" "$release_dir/Deploy"
  tar --no-same-owner --no-same-permissions -xzf "$package_dir/frontend.tar.gz" -C "$release_dir/public"
  cp "$script_path" "$release_dir/Deploy/server-release.sh"
  cp "$package_dir/commit" "$package_dir/production-url" "$release_dir/"
  printf '%s\n' static > "$release_dir/kind"
  valid_release "$release_dir" || fail 'Archive is not the expected frontend build'
else
  [[ -n "$original_previous" ]] || fail 'No previous static release is available'
  release_dir="$original_previous"
fi

previous_release="$original_current"
if [[ -z "$previous_release" ]]; then
  previous_release="$deploy_root/releases/bootstrap-$(date +%s)-$$"
  mkdir -p "$previous_release/public" "$previous_release/Deploy"
  rsync --archive --exclude='.well-known/' "$web_root/" "$previous_release/public/"
  cp "$script_path" "$previous_release/Deploy/server-release.sh"
  cp "$release_dir/production-url" "$previous_release/"
  printf '%s\n' bootstrap > "$previous_release/kind"
  valid_release "$previous_release" || fail 'Existing web root is not a regular static site'
fi

changed=0
finished=0
cleanup() {
  result=$?
  trap - EXIT INT TERM
  if (( result != 0 && changed == 1 && finished == 0 )); then
    printf 'Frontend deployment failed; restoring the previous static files.\n' >&2
    if publish_release "$previous_release" && verify_release "$previous_release" &&
      set_link static-current "$original_current" && set_link static-previous "$original_previous"; then
      printf 'Previous frontend restored.\n' >&2
    else
      printf 'ROLLBACK FAILED: inspect /var/www/klan and the saved static release.\n' >&2
    fi
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
changed=1
publish_release "$release_dir"
verify_release "$release_dir"

# Keep signal handling out of the short state commit; failures still restore both links.
trap '' INT TERM
set_link static-previous "$previous_release"
set_link static-current "$release_dir"
finished=1
trap 'exit 130' INT
trap 'exit 143' TERM
printf 'Frontend static release %s is published and HTTP checked.\n' "$(basename -- "$release_dir")"
