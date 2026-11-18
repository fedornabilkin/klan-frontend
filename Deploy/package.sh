#!/usr/bin/env bash
set -euo pipefail

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ "${GITHUB_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || fail 'Invalid commit'
[[ $# == 2 ]] || fail 'Usage: package.sh DIST_DIR ARTIFACT_DIR'
dist_dir="$(realpath -- "$1")"
[[ -d "$dist_dir" && -f "$dist_dir/index.html" ]] || fail 'Missing frontend build'
# A clean CI build receives no deployment secrets. Only regular public build files may ship.
[[ -z "$(find "$dist_dir" -mindepth 1 \( -name '.*' -o -type l \) -print -quit)" ]] || fail 'Build contains a hidden file or symlink'
[[ -z "$(find "$dist_dir" ! -type f ! -type d -print -quit)" ]] || fail 'Build contains a non-regular file'
printf '%s\n' "$GITHUB_SHA" > "$dist_dir/deploy-version.txt"
printf '%s\n' klan-frontend > "$dist_dir/deploy-site.txt"
mkdir -p -- "$2"
artifact_dir="$(realpath -- "$2")"
[[ "$artifact_dir/" != "$dist_dir/"* ]] || fail 'Artifact directory must be outside the build'
tar -C "$dist_dir" -czf "$artifact_dir/frontend.tar.gz" .
checksum="$(sha256sum "$artifact_dir/frontend.tar.gz")"
printf '%s\n' "${checksum%% *}" > "$artifact_dir/frontend.tar.gz.sha256"
