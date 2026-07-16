import { describe, expect, it } from "vitest";

import { formatVncAddress, parseVncAddress } from "./index";

describe("VNC addresses", () => {
  it("defaults to port 5900", () => {
    expect(parseVncAddress("studio.local")).toEqual({ host: "studio.local", port: 5900 });
  });

  it("parses credentials and IPv6", () => {
    expect(parseVncAddress("vnc://alex@[::1]:5901")).toEqual({
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
});
