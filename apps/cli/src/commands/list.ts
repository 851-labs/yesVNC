import { formatVncAddress } from "@yesvnc/config";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { ConnectionStoreService } from "../services";

export const listCommand = Command.make(
  "list",
  {
    json: Flag.boolean("json").pipe(Flag.withDescription("Print machine-readable JSON")),
  },
  ({ json }) =>
    Effect.gen(function* () {
      const store = yield* Effect.service(ConnectionStoreService);
      const { connections } = yield* store.read();
      yield* Effect.sync(() => {
        if (json) {
          console.log(JSON.stringify({ connections }, null, 2));
          return;
        }
        if (connections.length === 0) {
          console.log("No saved connections. Add one with `yesvnc add <name> <host>`. ");
          return;
        }
        const width = Math.max(
          "NAME".length,
          ...connections.map((connection) => connection.name.length),
        );
        console.log(
          [
            `${"NAME".padEnd(width)}  ADDRESS`,
            ...connections.map(
              (connection) => `${connection.name.padEnd(width)}  ${formatVncAddress(connection)}`,
            ),
          ].join("\n"),
        );
      });
    }),
).pipe(Command.withDescription("List saved VNC connections"));
