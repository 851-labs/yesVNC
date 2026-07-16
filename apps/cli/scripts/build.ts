import { chmod, copyFile, mkdir, rm } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });
await mkdir(new URL("THIRD_PARTY_LICENSES/", dist), { recursive: true });

const viewer = await Bun.build({
  entrypoints: [new URL("../src/viewer/client.ts", import.meta.url).pathname],
  minify: true,
  outdir: dist.pathname,
  target: "browser",
});

const cli = await Bun.build({
  entrypoints: [new URL("../src/index.ts", import.meta.url).pathname],
  minify: true,
  outdir: dist.pathname,
  target: "bun",
});

if (!viewer.success || !cli.success) {
  for (const log of [...viewer.logs, ...cli.logs]) console.error(log);
  process.exit(1);
}

await chmod(new URL("index.js", dist), 0o755);
await copyFile(
  new URL("../node_modules/@novnc/novnc/LICENSE.txt", import.meta.url),
  new URL("THIRD_PARTY_LICENSES/noVNC.txt", dist),
);
