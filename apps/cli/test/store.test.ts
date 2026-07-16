import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { readStore, writeStore } from "../src/services/store";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("connection store", () => {
  it("returns an empty store when the file does not exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yesvnc-"));
    dirs.push(dir);
    await expect(Effect.runPromise(readStore(join(dir, "missing.json")))).resolves.toEqual({
      version: 1,
      connections: [],
    });
  });

  it("writes stable JSON with private permissions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yesvnc-"));
    dirs.push(dir);
    const path = join(dir, "nested", "connections.json");
    await Effect.runPromise(
      writeStore(
        { version: 1, connections: [{ name: "studio", host: "mac.local", port: 5900 }] },
        path,
      ),
    );
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
      version: 1,
      connections: [{ name: "studio" }],
    });
  });
});
