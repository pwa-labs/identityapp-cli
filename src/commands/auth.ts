import type { RuntimeContext } from "../types";
import { fail } from "../lib/errors";
import { readConfig, writeConfig } from "../lib/storage";

export async function handleAuth(args: string[], ctx: RuntimeContext) {
  const subcommand = args[0];
  const rest = args.slice(1);
  if (subcommand !== "link") {
    fail("Usage: identityapp auth link <set|show|clear> ...");
  }

  const action = rest[0];
  const actionArgs = rest.slice(1);
  const config = readConfig(ctx);

  if (action === "set") {
    const key = actionArgs[0];
    if (!key) fail("Usage: identityapp auth link set <linking_key>");
    writeConfig(ctx, { ...config, defaultLinkingKey: key });
    console.log(JSON.stringify({ ok: true, defaultLinkingKey: "[set]" }, null, 2));
    return;
  }
  if (action === "show") {
    console.log(
      JSON.stringify(
        {
          defaultLinkingKey: config.defaultLinkingKey ? "[set]" : null,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (action === "clear") {
    writeConfig(ctx, { ...config, defaultLinkingKey: null });
    console.log(JSON.stringify({ ok: true, defaultLinkingKey: null }, null, 2));
    return;
  }

  fail("Usage: identityapp auth link <set|show|clear> ...");
}
