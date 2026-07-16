export const DEFAULT_VNC_PORT = 5900;

export interface Connection {
  readonly host: string;
  readonly name: string;
  readonly port: number;
  readonly username?: string;
}

export interface ConnectionStore {
  readonly connections: readonly Connection[];
  readonly version: 1;
}

export interface VncAddress {
  readonly host: string;
  readonly port: number;
  readonly username?: string;
}

export class InvalidAddressError extends Error {
  readonly _tag = "InvalidAddressError";

  constructor(readonly address: string) {
    super(`Invalid VNC address: ${address}`);
  }
}

export function parseVncAddress(input: string): VncAddress {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new InvalidAddressError(input);
  }

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `vnc://${trimmed}`);
  } catch {
    throw new InvalidAddressError(input);
  }

  if (url.protocol !== "vnc:") {
    throw new InvalidAddressError(input);
  }

  const port = url.port.length > 0 ? Number(url.port) : DEFAULT_VNC_PORT;
  if (!url.hostname || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new InvalidAddressError(input);
  }

  const username = decodeURIComponent(url.username);
  const host =
    url.hostname.startsWith("[") && url.hostname.endsWith("]")
      ? url.hostname.slice(1, -1)
      : url.hostname;
  return {
    host,
    port,
    ...(username.length > 0 ? { username } : {}),
  };
}

export function formatVncAddress(connection: VncAddress): string {
  const host = connection.host.includes(":") ? `[${connection.host}]` : connection.host;
  const username = connection.username ? `${encodeURIComponent(connection.username)}@` : "";
  return `vnc://${username}${host}:${connection.port}`;
}

export function isConnection(value: unknown): value is Connection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Connection>;
  return (
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    typeof candidate.host === "string" &&
    candidate.host.length > 0 &&
    typeof candidate.port === "number" &&
    Number.isInteger(candidate.port) &&
    candidate.port > 0 &&
    candidate.port <= 65_535 &&
    (candidate.username === undefined || typeof candidate.username === "string")
  );
}

export function parseConnectionStore(value: unknown): ConnectionStore {
  if (!value || typeof value !== "object") throw new Error("Expected a JSON object");
  const candidate = value as Partial<ConnectionStore>;
  if (candidate.version !== 1 || !Array.isArray(candidate.connections)) {
    throw new Error("Expected a version 1 connection store");
  }
  if (!candidate.connections.every(isConnection)) {
    throw new Error("The connection store contains an invalid connection");
  }
  return { version: 1, connections: candidate.connections };
}
