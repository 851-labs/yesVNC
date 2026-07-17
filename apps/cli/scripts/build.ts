import { chmod, copyFile, mkdir, rm } from "node:fs/promises";

import { copyNoVncAssets } from "./novnc-assets";

const dist = new URL("../dist/", import.meta.url);
await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });
await mkdir(new URL("THIRD_PARTY_LICENSES/", dist), { recursive: true });

const cli = await Bun.build({
  entrypoints: [new URL("../src/index.ts", import.meta.url).pathname],
  minify: true,
  outdir: dist.pathname,
  target: "bun",
});

if (!cli.success) {
  for (const log of cli.logs) console.error(log);
  process.exit(1);
}

await chmod(new URL("index.js", dist), 0o755);
await copyFile(
  new URL("../node_modules/@novnc/novnc/LICENSE.txt", import.meta.url),
  new URL("THIRD_PARTY_LICENSES/noVNC.txt", dist),
);
await copyNoVncAssets(new URL("novnc/", dist).pathname);
