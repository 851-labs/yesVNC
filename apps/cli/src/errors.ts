import { Cause, Effect, Option } from "effect";
import { CliError } from "effect/unstable/cli";

export function renderCliFailure<E>(cause: Cause.Cause<E>, verbose: boolean) {
  if (Cause.hasInterruptsOnly(cause)) return Effect.void;
  const error = Cause.findErrorOption(cause);
  if (Option.isSome(error) && CliError.isCliError(error.value) && error.value._tag === "ShowHelp") {
    return Effect.void;
  }

  const value = Option.isSome(error) ? error.value : undefined;
  const message =
    value instanceof Error && value.message.startsWith("error:")
      ? value.message
      : "error: unexpected CLI failure\nhint: rerun with --verbose for details";

  return Effect.sync(() => {
    console.error(message);
    if (verbose) console.error(`debug:\n${Cause.pretty(cause)}`);
  });
}

export function isVerboseArgv(argv: readonly string[]) {
  return argv.includes("--verbose") && !argv.includes("--no-verbose");
}
