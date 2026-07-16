#!/usr/bin/env bun

import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer } from "effect";

import { runYesvncCommand } from "./commands/root";
import { isVerboseArgv, renderCliFailure } from "./errors";
import { CliServicesLive } from "./services";

export function mainEffect(argv = process.argv.slice(2)) {
  const normalized = argv.length === 1 && argv[0] === "-v" ? ["--version"] : argv;
  return runYesvncCommand(normalized).pipe(
    Effect.tapCause((cause) => renderCliFailure(cause, isVerboseArgv(normalized))),
  );
}

if (import.meta.main) {
  BunRuntime.runMain(
    mainEffect().pipe(Effect.provide(Layer.mergeAll(CliServicesLive, BunServices.layer))),
    { disableErrorReporting: true },
  );
}
