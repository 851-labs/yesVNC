#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tapDir = process.argv[2];
const version = process.env.VERSION;
const repository = process.env.REPOSITORY ?? process.env.GITHUB_REPOSITORY ?? "851-labs/yesVNC";
const artifactDir = process.env.ARTIFACT_DIR ?? "dist/release";

if (!tapDir) throw new Error("usage: update-homebrew-tap.mjs <tap-dir>");
if (!version) throw new Error("VERSION is required");

const assets = {
  arm64: "yesvnc-darwin-arm64.tar.gz",
  x64: "yesvnc-darwin-x64.tar.gz",
};
const sha256 = (file) =>
  createHash("sha256")
    .update(readFileSync(join(artifactDir, file)))
    .digest("hex");
const url = (file) => `https://github.com/${repository}/releases/download/v${version}/${file}`;

mkdirSync(join(tapDir, "Formula"), { recursive: true });
writeFileSync(
  join(tapDir, "Formula", "yesvnc.rb"),
  `class Yesvnc < Formula
  desc "Manage VNC connections and open them in a local browser viewer"
  homepage "https://yesvnc.851.workers.dev"
  version "${version}"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "${url(assets.arm64)}"
      sha256 "${sha256(assets.arm64)}"
    else
      url "${url(assets.x64)}"
      sha256 "${sha256(assets.x64)}"
    end
  end

  def install
    libexec.install "bin", "share"
    bin.install_symlink libexec/"bin/yesvnc"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/yesvnc --version")
  end
end
`,
);

console.log(`Updated Homebrew formula for yesVNC ${version}`);
