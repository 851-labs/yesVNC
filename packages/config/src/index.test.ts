import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import {
  decodeConnectionStore,
  decodeConnectionStoreJson,
  formatVncAddress,
  parseVncAddress,
} from "./index";

describe("VNC addresses", () => {
  it("defaults to port 5900", () => {
    expect(Effect.runSync(parseVncAddress("studio.local"))).toEqual({
      host: "studio.local",
      port: 5900,
    });
  });

  it("parses credentials and IPv6", () => {
    expect(Effect.runSync(parseVncAddress("vnc://alex@[::1]:5901"))).toEqual({
      host: "::1",
      port: 5901,
      username: "alex",
    });
  });

  it("formats a normalized URL", () => {
    expect(formatVncAddress({ host: "mac.local", port: 5902 })).toBe("vnc://mac.local:5902");
  });

  it("formats IPv6 with one pair of brackets", () => {
    expect(formatVncAddress({ host: "::1", port: 5900 })).toBe("vnc://[::1]:5900");
  });

  it("returns a typed failure for invalid addresses", () => {
    const exit = Effect.runSyncExit(parseVncAddress("https://example.com"));
    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("connection schemas", () => {
  const store = {
    version: 1,
    connections: [{ name: "studio", host: "studio.local", port: 5900 }],
  } as const;

  it("decodes unknown connection stores", () => {
    expect(Effect.runSync(decodeConnectionStore(store))).toEqual(store);
  });

  it("decodes connection stores directly from JSON", () => {
    expect(Effect.runSync(decodeConnectionStoreJson(JSON.stringify(store)))).toEqual(store);
  });

  it("rejects invalid ports", () => {
    const exit = Effect.runSyncExit(
      decodeConnectionStore({
        version: 1,
        connections: [{ name: "studio", host: "studio.local", port: 70_000 }],
      }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });
});
