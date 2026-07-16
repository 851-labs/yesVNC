import { Command, Flag, GlobalFlag } from "effect/unstable/cli";

import packageJson from "../../package.json";
import { addCommand } from "./add";
import { connectCommand } from "./connect";
import { listCommand } from "./list";
import { removeCommand } from "./remove";

export const verboseGlobalFlag = GlobalFlag.setting("verbose")({
  flag: Flag.boolean("verbose").pipe(
    Flag.withDescription("Print internal stack traces on failures"),
  ),
});

export const yesvncCommand = Command.make("yesvnc").pipe(
  Command.withDescription("Manage VNC connections and open them in a local browser viewer"),
  Command.withGlobalFlags([verboseGlobalFlag]),
  Command.withSubcommands([connectCommand, addCommand, listCommand, removeCommand]),
);

export const runYesvncCommand = Command.runWith(yesvncCommand, { version: packageJson.version });
