import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { resolveTarget, suggestConnectionName } from "../src/commands/connect";

const connections = [
  {
    host: "tuftlords-macbook-pro.tail6fc9a.ts.net",
    name: "tuftlord-over-tailscale",
    port: 5900,
    username: "tuftlord",
  },
];

const store = {
  read: () => Effect.succeed({ connections }),
};

describe("connect target suggestions", () => {
  it("suggests a saved connection when one character is missing", () => {
    expect(
      suggestConnectionName(
        "tuftlord-over-tailscal",
        connections.map(({ name }) => name),
      ),
    ).toBe("tuftlord-over-tailscale");
  });

  it("returns a helpful error instead of treating a typo as a hostname", () => {
    const error = Effect.runSync(Effect.flip(resolveTarget("tuftlord-over-tailscal", store)));
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain('did you mean "tuftlord-over-tailscale"?');
    expect(String(error)).toContain("use vnc://tuftlord-over-tailscal");
  });

  it("still accepts unrelated direct hosts", () => {
    expect(Effect.runSync(resolveTarget("studio.local:5901", store))).toEqual({
      host: "studio.local",
      name: "studio.local:5901",
      port: 5901,
    });
  });

  it("does not suggest saved names for explicit VNC URLs", () => {
    expect(
      suggestConnectionName(
        "vnc://tuftlord-over-tailscal",
        connections.map(({ name }) => name),
      ),
    ).toBeUndefined();
  });
});
