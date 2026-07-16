import { resolve } from "node:path";

import { copyNoVncAssets, defaultNoVncDestination } from "./novnc-assets";

const destination = Bun.argv[2] ? resolve(Bun.argv[2]) : defaultNoVncDestination();
await copyNoVncAssets(destination);
console.log(`Copied noVNC UI assets to ${destination}`);
