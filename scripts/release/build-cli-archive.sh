#!/bin/sh
set -eu

version="${1:?usage: build-cli-archive.sh <version> <out-dir> <bun-target>}"
out_dir="${2:?usage: build-cli-archive.sh <version> <out-dir> <bun-target>}"
target="${3:?usage: build-cli-archive.sh <version> <out-dir> <bun-target>}"
root_dir=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
work_dir="$out_dir/work/yesvnc-$target"
archive="$out_dir/yesvnc-$target.tar.gz"

rm -rf "$work_dir"
mkdir -p "$work_dir/bin" "$work_dir/share/yesvnc" "$out_dir"
cp "$root_dir/apps/cli/node_modules/@novnc/novnc/LICENSE.txt" "$work_dir/share/yesvnc/LICENSE.noVNC.txt"

bun build "$root_dir/apps/cli/src/viewer/client.ts" \
  --target browser \
  --minify \
  --outfile "$work_dir/share/yesvnc/viewer.js"

bun build "$root_dir/apps/cli/src/index.ts" \
  --compile \
  --minify \
  --target "bun-$target" \
  --define "YESVNC_RELEASE_VERSION=\"$version\"" \
  --outfile "$work_dir/bin/yesvnc"

tar -C "$work_dir" -czf "$archive" bin share
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$archive" > "$archive.sha256"
else
  sha256sum "$archive" > "$archive.sha256"
fi

printf 'Built %s\n' "$archive"
