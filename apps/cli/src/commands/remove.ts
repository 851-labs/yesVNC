import { Data, Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";

import { ConnectionStoreService } from "../services";

export class ConnectionNotFoundError extends Data.TaggedError("ConnectionNotFoundError")<{
  readonly name: string;
}> {
  override get message() {
    return `error: no saved connection named "${this.name}"\nhint: run yesvnc list`;
  }
}

export const removeCommand = Command.make(
  "remove",
  {
    name: Argument.string("name").pipe(Argument.withDescription("Saved connection name")),
  },
  ({ name }) =>
    Effect.gen(function* () {
      const store = yield* Effect.service(ConnectionStoreService);
      const removed = yield* store.remove(name);
      if (!removed) return yield* Effect.fail(new ConnectionNotFoundError({ name }));
      yield* Effect.sync(() => console.log(`Removed ${name}`));
    }),
).pipe(Command.withDescription("Remove a saved VNC connection"));
