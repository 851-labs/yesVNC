import { formatVncAddress, parseVncAddress, type Connection } from "@yesvnc/config";
import { Data, Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { BrowserService, ConnectionStoreService, startViewerServer } from "../services";

export class ConnectTargetError extends Data.TaggedError("ConnectTargetError")<{
  readonly suggestion?: string;
  readonly target: string;
}> {
  override get message() {
    if (this.suggestion) {
      return `error: no saved connection named "${this.target}"\nhint: did you mean "${this.suggestion}"?\nhint: use vnc://${this.target} to connect to that hostname directly`;
    }
    return `error: "${this.target}" is neither a saved connection nor a valid VNC address\nhint: run yesvnc list or use host:port`;
  }
}

export class ViewerStartError extends Data.TaggedError("ViewerStartError")<{
  readonly cause: unknown;
}> {
  override get message() {
    return `error: could not start the local yesVNC viewer\nhint: rerun with --verbose for details`;
  }
}

export class BrowserOpenError extends Data.TaggedError("BrowserOpenError")<{
  readonly cause: unknown;
  readonly url: string;
}> {
  override get message() {
    return `error: could not open the browser\nhint: open ${this.url}`;
  }
}

export const connectCommand = Command.make(
  "connect",
  {
    target: Argument.string("target").pipe(
      Argument.withDescription("Saved connection name or VNC server address"),
    ),
    noOpen: Flag.boolean("no-open").pipe(
      Flag.withDescription("Print the local URL without opening a browser"),
    ),
    port: Flag.integer("port").pipe(
      Flag.withDescription("Preferred port for the local viewer server"),
      Flag.optional,
    ),
    username: Flag.string("username").pipe(
      Flag.withDescription("Override the VNC username"),
      Flag.optional,
    ),
    viewOnly: Flag.boolean("view-only").pipe(
      Flag.withDescription("Disable keyboard and pointer input"),
    ),
  },
  ({ noOpen, port, target, username, viewOnly }) =>
    Effect.gen(function* () {
      const store = yield* Effect.service(ConnectionStoreService);
      const browser = yield* Effect.service(BrowserService);
      const connection = yield* resolveTarget(target, store);
      const resolvedUsername = Option.getOrUndefined(username) ?? connection.username;
      const resolved = {
        ...connection,
        ...(resolvedUsername ? { username: resolvedUsername } : {}),
      };
      const password = process.env.YESVNC_PASSWORD;
      const localPort = Option.getOrUndefined(port);
      const viewerServer = yield* Effect.tryPromise({
        try: () =>
          startViewerServer(
            {
              ...resolved,
              ...(password ? { password } : {}),
              viewOnly,
            },
            localPort === undefined ? {} : { port: localPort },
          ),
        catch: (cause) => new ViewerStartError({ cause }),
      });

      yield* Effect.sync(() => {
        console.log(`Connecting to ${formatVncAddress(resolved)}`);
        console.log(`Viewer: ${viewerServer.url}`);
        console.log("Press Ctrl-C to stop the local server.");
      });

      if (!noOpen) {
        yield* browser
          .open(viewerServer.url)
          .pipe(Effect.mapError((cause) => new BrowserOpenError({ cause, url: viewerServer.url })));
      }

      yield* Effect.tryPromise(() => waitForShutdown()).pipe(
        Effect.ensuring(Effect.sync(() => viewerServer.stop())),
      );
    }),
).pipe(
  Command.withDescription("Start a local noVNC viewer for a connection"),
  Command.withExamples([
    { command: "yesvnc connect studio", description: "Connect using a saved name" },
    {
      command: "yesvnc connect 192.168.1.20:5900",
      description: "Connect directly without saving",
    },
    {
      command: "yesvnc connect studio --view-only",
      description: "Connect without sending input",
    },
  ]),
);

export function resolveTarget(
  target: string,
  store: { readonly read: () => Effect.Effect<{ connections: readonly Connection[] }, unknown> },
) {
  return Effect.gen(function* () {
    const { connections } = yield* store.read();
    const saved = connections.find((connection) => connection.name === target);
    if (saved) return saved;

    const suggestion = suggestConnectionName(
      target,
      connections.map((connection) => connection.name),
    );
    if (suggestion) {
      return yield* Effect.fail(new ConnectTargetError({ suggestion, target }));
    }

    return yield* parseVncAddress(target).pipe(
      Effect.map((address) => ({ ...address, name: target })),
      Effect.mapError(() => new ConnectTargetError({ target })),
    );
  });
}

export function suggestConnectionName(
  target: string,
  connectionNames: readonly string[],
): string | undefined {
  if (target.includes("://") || connectionNames.length === 0) return undefined;

  const normalizedTarget = target.toLowerCase();
  const maxDistance = normalizedTarget.length <= 4 ? 1 : normalizedTarget.length <= 12 ? 2 : 3;
  let closest: { distance: number; name: string } | undefined;

  for (const name of connectionNames) {
    const distance = editDistance(normalizedTarget, name.toLowerCase());
    if (distance > maxDistance || (closest && distance >= closest.distance)) continue;
    closest = { distance, name };
  }

  return closest?.name;
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + substitutionCost,
      );
    }
    previous = current;
  }

  return previous[right.length]!;
}

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      process.off("SIGINT", done);
      process.off("SIGTERM", done);
      resolve();
    };
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}
