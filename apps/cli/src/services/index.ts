import { Layer } from "effect";

import { BrowserLive } from "./browser";
import { ConnectionStoreLive } from "./store";

export { BrowserLive, BrowserService } from "./browser";
export { startViewerServer, type ViewerKind, type ViewerServer, type ViewerTarget } from "./server";
export {
  ConnectionStoreLive,
  ConnectionStoreService,
  getStorePath,
  readStore,
  removeConnection,
  upsertConnection,
  writeStore,
} from "./store";

export const CliServicesLive = Layer.mergeAll(BrowserLive, ConnectionStoreLive);
