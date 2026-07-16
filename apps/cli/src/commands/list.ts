import { formatVncAddress } from "@yesvnc/config";
import { Console, Effect } from "effect";
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
      if (json) {
        yield* Console.log(JSON.stringify({ connections }, null, 2));
        return;
      }
      if (connections.length === 0) {
        yield* Console.log("No saved connections. Add one with `yesvnc add <name> <host>`. ");
        return;
      }
      yield* Console.table(
        connections.map((connection) => ({
          NAME: connection.name,
          ADDRESS: formatVncAddress(connection),
        })),
      );
    }),
).pipe(Command.withDescription("List saved VNC connections"));
