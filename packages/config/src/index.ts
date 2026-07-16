import { Data, Effect, Schema, type SchemaError } from "effect";

export const DEFAULT_VNC_PORT = 5900;

const NonEmptyString = Schema.String.check(Schema.isNonEmpty());
const VncPort = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65_535 }));

export const VncAddressSchema = Schema.Struct({
  host: NonEmptyString,
  port: VncPort,
  username: Schema.optionalKey(Schema.String),
});

export type VncAddress = typeof VncAddressSchema.Type;

export const ConnectionSchema = Schema.Struct({
  host: NonEmptyString,
  name: NonEmptyString,
  port: VncPort,
  username: Schema.optionalKey(Schema.String),
});

export type Connection = typeof ConnectionSchema.Type;

export const ConnectionStoreSchema = Schema.Struct({
  connections: Schema.Array(ConnectionSchema),
  version: Schema.Literal(1),
});

export type ConnectionStore = typeof ConnectionStoreSchema.Type;

export const ConnectionStoreJsonSchema = Schema.fromJsonString(ConnectionStoreSchema);

export class InvalidAddressError extends Data.TaggedError("InvalidAddressError")<{
  readonly address: string;
}> {
  override get message() {
    return `error: invalid VNC address "${this.address}"\nhint: use host, host:port, or vnc://host:port`;
  }
}

export type ConnectionDecodeError = SchemaError.SchemaError;

export const decodeConnection = Schema.decodeUnknownEffect(ConnectionSchema);
export const decodeConnectionStore = Schema.decodeUnknownEffect(ConnectionStoreSchema);
export const decodeConnectionStoreJson = Schema.decodeUnknownEffect(ConnectionStoreJsonSchema);
export const decodeVncAddress = Schema.decodeUnknownEffect(VncAddressSchema);

export function parseVncAddress(input: string): Effect.Effect<VncAddress, InvalidAddressError> {
  return Effect.gen(function* () {
    const trimmed = input.trim();
    if (trimmed.length === 0) return yield* invalidAddress(input);

    const url = yield* Effect.try({
      try: () => new URL(trimmed.includes("://") ? trimmed : `vnc://${trimmed}`),
      catch: () => new InvalidAddressError({ address: input }),
    });
    if (url.protocol !== "vnc:") return yield* invalidAddress(input);

    const port = url.port.length > 0 ? Number(url.port) : DEFAULT_VNC_PORT;
    const username = decodeURIComponent(url.username);
    const host =
      url.hostname.startsWith("[") && url.hostname.endsWith("]")
        ? url.hostname.slice(1, -1)
        : url.hostname;

    return yield* decodeVncAddress({
      host,
      port,
      ...(username.length > 0 ? { username } : {}),
    }).pipe(Effect.mapError(() => new InvalidAddressError({ address: input })));
  });
}

export function formatVncAddress(connection: VncAddress): string {
  const host = connection.host.includes(":") ? `[${connection.host}]` : connection.host;
  const username = connection.username ? `${encodeURIComponent(connection.username)}@` : "";
  return `vnc://${username}${host}:${connection.port}`;
}

export function isConnection(value: unknown): value is Connection {
  return Schema.is(ConnectionSchema)(value);
}

function invalidAddress(address: string): Effect.Effect<never, InvalidAddressError> {
  return Effect.fail(new InvalidAddressError({ address }));
}
