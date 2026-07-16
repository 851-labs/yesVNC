import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { type Connection, type ConnectionStore, parseConnectionStore } from "@yesvnc/config";
import { Context, Data, Effect, Layer } from "effect";

const emptyStore: ConnectionStore = { version: 1, connections: [] };

export class StoreReadError extends Data.TaggedError("StoreReadError")<{
  readonly cause: unknown;
  readonly path: string;
}> {
  override get message() {
    return `error: could not read connections from ${this.path}\nhint: fix the file or set YESVNC_CONFIG_DIR`;
  }
}

export class StoreWriteError extends Data.TaggedError("StoreWriteError")<{
  readonly cause: unknown;
  readonly path: string;
}> {
  override get message() {
    return `error: could not save connections to ${this.path}\nhint: check the directory permissions`;
  }
}

export function getStorePath(env: Record<string, string | undefined> = process.env): string {
  const configured = env.YESVNC_CONFIG_DIR;
  if (configured) return join(configured, "connections.json");

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "yesVNC", "connections.json");
  }

  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "yesvnc", "connections.json");
}

export function readStore(path = getStorePath()) {
  return Effect.tryPromise({
    try: async () => parseConnectionStore(JSON.parse(await readFile(path, "utf8"))),
    catch: (cause) => cause,
  }).pipe(
    Effect.catch((cause) => {
      if (hasErrorCode(cause, "ENOENT")) return Effect.succeed(emptyStore);
      return Effect.fail(new StoreReadError({ cause, path }));
    }),
  );
}

export function writeStore(store: ConnectionStore, path = getStorePath()) {
  return Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
      await chmod(path, 0o600);
    },
    catch: (cause) => new StoreWriteError({ cause, path }),
  });
}

export function upsertConnection(connection: Connection, force: boolean) {
  return Effect.gen(function* () {
    const store = yield* readStore();
    const existing = store.connections.find((item) => item.name === connection.name);
    if (existing && !force) return { _tag: "Exists" as const, connection: existing };

    const connections = [
      ...store.connections.filter((item) => item.name !== connection.name),
      connection,
    ].toSorted((left, right) => left.name.localeCompare(right.name));
    yield* writeStore({ version: 1, connections });
    return { _tag: "Saved" as const, connection };
  });
}

export function removeConnection(name: string) {
  return Effect.gen(function* () {
    const store = yield* readStore();
    const connection = store.connections.find((item) => item.name === name);
    if (!connection) return undefined;
    yield* writeStore({
      version: 1,
      connections: store.connections.filter((item) => item.name !== name),
    });
    return connection;
  });
}

export class ConnectionStoreService extends Context.Service<
  ConnectionStoreService,
  {
    readonly read: typeof readStore;
    readonly remove: typeof removeConnection;
    readonly upsert: typeof upsertConnection;
  }
>()("ConnectionStoreService") {}

export const ConnectionStoreLive = Layer.succeed(ConnectionStoreService)({
  read: readStore,
  remove: removeConnection,
  upsert: upsertConnection,
});

function hasErrorCode(value: unknown, code: string): boolean {
  return value instanceof Error && "code" in value && value.code === code;
}
