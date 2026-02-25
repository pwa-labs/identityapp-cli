import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import type { Credentials, RuntimeContext } from "../types";
import { fail } from "../lib/errors";
import { readJsonFile } from "../lib/fs";
import {
  identityPathForAlias,
  loadIdentityFromAlias,
  normalizeAlias,
  readConfig,
  redactPrivateKey,
  writeConfig,
} from "../lib/storage";

export async function handleIdentity(args: string[], ctx: RuntimeContext) {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (subcommand === "list") {
    const config = readConfig(ctx);
    if (!fs.existsSync(ctx.identitiesDir)) {
      console.log(
        JSON.stringify({ defaultAlias: config.defaultAlias, identities: [] }, null, 2),
      );
      return;
    }
    const files = fs
      .readdirSync(ctx.identitiesDir)
      .filter((name) => name.endsWith(".json"))
      .sort();
    const identities = files.map((fileName) => {
      const filePath = path.join(ctx.identitiesDir, fileName);
      const identity = readJsonFile(filePath) as Partial<Credentials>;
      const alias = fileName.slice(0, -5);
      return {
        alias,
        did: identity.did ?? null,
        label: identity.label ?? null,
        updatedAt: identity.updatedAt ?? null,
        isDefault: config.defaultAlias === alias,
      };
    });
    console.log(
      JSON.stringify(
        {
          home: ctx.home,
          defaultAlias: config.defaultAlias,
          identities,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (subcommand === "show") {
    const { values } = parseArgs({
      args: rest,
      options: {
        as: { type: "string" },
      },
      strict: true,
      allowPositionals: false,
    });
    const config = readConfig(ctx);
    const identity = loadIdentityFromAlias(ctx, config, values.as);
    console.log(
      JSON.stringify(
        {
          home: ctx.home,
          ...redactPrivateKey(identity),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (subcommand === "use") {
    const alias = rest[0];
    if (!alias) fail("Usage: identityapp identity use <alias>");
    const normalized = normalizeAlias(alias);
    const identityPath = identityPathForAlias(ctx, normalized);
    if (!fs.existsSync(identityPath)) {
      fail(`Identity alias "${normalized}" not found.`);
    }
    const config = readConfig(ctx);
    writeConfig(ctx, { ...config, defaultAlias: normalized });
    console.log(JSON.stringify({ ok: true, defaultAlias: normalized }, null, 2));
    return;
  }

  if (subcommand === "remove") {
    const { values } = parseArgs({
      args: rest,
      options: {
        as: { type: "string" },
        yes: { type: "boolean" },
      },
      strict: true,
      allowPositionals: false,
    });
    if (!values.as) fail("Usage: identityapp identity remove --as <alias> --yes");
    if (values.yes !== true) {
      fail("Refusing to remove identity without --yes");
    }
    const alias = normalizeAlias(values.as);
    const target = identityPathForAlias(ctx, alias);
    if (!fs.existsSync(target)) {
      fail(`Identity alias "${alias}" not found.`);
    }
    fs.rmSync(target);
    const config = readConfig(ctx);
    const nextConfig =
      config.defaultAlias === alias ? { ...config, defaultAlias: null } : config;
    writeConfig(ctx, nextConfig);
    console.log(JSON.stringify({ ok: true, removed: alias }, null, 2));
    return;
  }

  fail("Usage: identityapp identity <list|show|use|remove> ...");
}
