import { cp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const cliRoot = resolve(import.meta.dir, "..");
const vendoredUi = join(cliRoot, "vendor", "novnc");
const packageRoot = join(cliRoot, "node_modules", "@novnc", "novnc");

export async function copyNoVncAssets(destination: string): Promise<void> {
  await rm(destination, { force: true, recursive: true });
  await mkdir(destination, { recursive: true });

  await Promise.all([
    cp(join(vendoredUi, "app"), join(destination, "app"), { recursive: true }),
    cp(join(packageRoot, "core"), join(destination, "core"), { recursive: true }),
    cp(join(packageRoot, "docs"), join(destination, "docs"), { recursive: true }),
    cp(join(packageRoot, "vendor"), join(destination, "vendor"), { recursive: true }),
    cp(join(vendoredUi, "vnc.html"), join(destination, "vnc.html")),
    cp(join(vendoredUi, "UPSTREAM.md"), join(destination, "UPSTREAM.md")),
    cp(join(packageRoot, "AUTHORS"), join(destination, "AUTHORS")),
    cp(join(packageRoot, "LICENSE.txt"), join(destination, "LICENSE.txt")),
    cp(join(packageRoot, "package.json"), join(destination, "package.json")),
  ]);
}

export function defaultNoVncDestination(): string {
  return join(cliRoot, "dist", "novnc");
}
