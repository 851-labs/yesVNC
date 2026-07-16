import { formatVncAddress, parseVncAddress } from "@yesvnc/config";
import { Data, Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { ConnectionStoreService } from "../services";

export class InvalidConnectionNameError extends Data.TaggedError("InvalidConnectionNameError")<{
  readonly name: string;
}> {
  override get message() {
    return `error: invalid connection name "${this.name}"\nhint: use letters, numbers, dots, dashes, or underscores`;
  }
}

export class ConnectionExistsError extends Data.TaggedError("ConnectionExistsError")<{
  readonly name: string;
}> {
  override get message() {
    return `error: a connection named "${this.name}" already exists\nhint: pass --force to replace it`;
  }
}

export const addCommand = Command.make(
  "add",
  {
    name: Argument.string("name").pipe(
      Argument.withDescription("Short name used to connect later"),
    ),
    address: Argument.string("address").pipe(
      Argument.withDescription("VNC server as host, host:port, or vnc:// URL"),
    ),
    force: Flag.boolean("force").pipe(
      Flag.withAlias("f"),
      Flag.withDescription("Replace a connection with the same name"),
    ),
    username: Flag.string("username").pipe(
      Flag.withDescription("Default VNC username"),
      Flag.optional,
    ),
  },
  ({ address, force, name, username }) =>
    Effect.gen(function* () {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
        return yield* Effect.fail(new InvalidConnectionNameError({ name }));
      }
      const parsed = yield* parseVncAddress(address);
      const store = yield* Effect.service(ConnectionStoreService);
      const resolvedUsername = Option.getOrUndefined(username) ?? parsed.username;
      const connection = {
        ...parsed,
        name,
        ...(resolvedUsername ? { username: resolvedUsername } : {}),
      };
      const result = yield* store.upsert(connection, force);
      if (result._tag === "Exists") {
        return yield* Effect.fail(new ConnectionExistsError({ name }));
      }
      yield* Effect.sync(() => console.log(`Saved ${name} (${formatVncAddress(connection)})`));
    }),
).pipe(
  Command.withDescription("Save a named VNC connection"),
  Command.withExamples([
    { command: "yesvnc add studio studio.local", description: "Save the default VNC port" },
    {
      command: "yesvnc add lab vnc://alex@10.0.0.8:5901",
      description: "Save a username and custom port",
    },
  ]),
);
