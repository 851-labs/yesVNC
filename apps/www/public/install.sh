#!/bin/sh
# yesVNC installer — https://yesvnc.com/install.sh
#
#   curl -fsSL https://yesvnc.com/install.sh | sh

set -eu

REPOSITORY="851-labs/yesVNC"
RELEASE_BASE="https://github.com/$REPOSITORY/releases/download"

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
fail() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"

[ "$(uname -s)" = "Darwin" ] || fail "yesVNC currently supports macOS"
case "$(uname -m)" in
  arm64) arch="arm64" ;;
  x86_64) arch="x64" ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac

if [ -n "${YESVNC_VERSION:-}" ]; then
  version="${YESVNC_VERSION#v}"
else
  manifest=$(curl -fsSL "https://api.github.com/repos/$REPOSITORY/releases/latest") || fail "could not resolve the latest release"
  version=$(printf '%s' "$manifest" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/p' | head -n 1)
  [ -n "$version" ] || fail "could not parse the latest release version"
fi

if [ "$(id -u)" = "0" ]; then
  install_dir="${YESVNC_INSTALL_DIR:-/usr/local/share/yesvnc}"
  bin_dir="${YESVNC_BIN_DIR:-/usr/local/bin}"
else
  install_dir="${YESVNC_INSTALL_DIR:-$HOME/.local/share/yesvnc}"
  bin_dir="${YESVNC_BIN_DIR:-$HOME/.local/bin}"
fi

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
asset="yesvnc-darwin-$arch.tar.gz"
url="$RELEASE_BASE/v$version/$asset"

say "Installing yesVNC $version for macOS ($arch)"
curl -fSL --progress-bar -o "$tmp_dir/$asset" "$url"
if command -v shasum >/dev/null 2>&1; then
  expected=$(curl -fsSL "$url.sha256" | awk '{print $1}')
  actual=$(shasum -a 256 "$tmp_dir/$asset" | awk '{print $1}')
  [ "$actual" = "$expected" ] || fail "checksum mismatch"
  say "Checksum verified"
fi

rm -rf "$install_dir"
mkdir -p "$install_dir" "$bin_dir"
tar -xzf "$tmp_dir/$asset" -C "$install_dir"
ln -sf "$install_dir/bin/yesvnc" "$bin_dir/yesvnc"

say "yesVNC $version installed"
case ":$PATH:" in
  *":$bin_dir:"*) note "Run: yesvnc --help" ;;
  *) note "Add $bin_dir to PATH, then run: yesvnc --help" ;;
esac
