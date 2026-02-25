import fs from "node:fs";
import path from "node:path";
import { DEFAULT_IDENTITY_HOME, IDENTITY_HOME_ENV } from "../constants";
import type { Credentials, IdentityConfig, RuntimeContext } from "../types";
import { fail } from "./errors";
import { readJsonFile, writeSecureJsonFile } from "./fs";

export function resolveHome(rawArgs: string[]) {
  const remaining: string[] = [];
  let homeFromArg: string | undefined;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];
    if (token === "--home") {
      homeFromArg = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith("--home=")) {
      homeFromArg = token.slice("--home=".length);
      continue;
    }
    remaining.push(token);
  }

  const home =
    homeFromArg || process.env[IDENTITY_HOME_ENV] || DEFAULT_IDENTITY_HOME;
  const absHome = path.resolve(home);
  return { home: absHome, args: remaining };
}

export function createContext(home: string): RuntimeContext {
  const identitiesDir = path.join(home, "identities");
  return {
    home,
    configPath: path.join(home, "config.json"),
    identitiesDir,
  };
}

function defaultConfig(): IdentityConfig {
  return {
    version: 1,
    defaultAlias: null,
    defaultLinkingKey: null,
  };
}

export function readConfig(ctx: RuntimeContext): IdentityConfig {
  if (!fs.existsSync(ctx.configPath)) {
    return defaultConfig();
  }
  const parsed = readJsonFile(ctx.configPath) as Partial<IdentityConfig>;
  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    defaultAlias:
      typeof parsed.defaultAlias === "string" ? parsed.defaultAlias : null,
    defaultLinkingKey:
      typeof parsed.defaultLinkingKey === "string"
        ? parsed.defaultLinkingKey
        : null,
  };
}

export function writeConfig(ctx: RuntimeContext, config: IdentityConfig) {
  writeSecureJsonFile(ctx.configPath, config);
}

export function normalizeAlias(alias: string): string {
  const normalized = alias.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,62}$/.test(normalized)) {
    fail(
      `Invalid alias "${alias}". Alias must start with a letter and contain only lowercase letters, digits, "_" or "-".`,
    );
  }
  return normalized;
}

export function identityPathForAlias(ctx: RuntimeContext, alias: string): string {
  return path.join(ctx.identitiesDir, `${normalizeAlias(alias)}.json`);
}

export function resolveAlias(
  requestedAlias: string | undefined,
  config: IdentityConfig,
): string {
  if (requestedAlias) return normalizeAlias(requestedAlias);
  if (config.defaultAlias) return normalizeAlias(config.defaultAlias);
  fail(
    'No alias selected. Pass --as <alias> or set a default with "identityapp identity use <alias>".',
  );
}

export function loadCredentials(filePath?: string): Credentials {
  if (!filePath) fail("Internal error: credentials file path is required");
  const json = readJsonFile(filePath) as Partial<Credentials>;
  if (!json.did || !json.privateKey) {
    fail(`Invalid credentials file: ${filePath} (missing did or privateKey)`);
  }
  return {
    did: json.did,
    publicKey: json.publicKey,
    privateKey: json.privateKey,
    linked: json.linked,
    claimToken: json.claimToken,
  };
}

export function saveCredentials(filePath: string, creds: Credentials) {
  writeSecureJsonFile(filePath, creds);
}

export function loadIdentityFromAlias(
  ctx: RuntimeContext,
  config: IdentityConfig,
  requestedAlias?: string,
): Credentials {
  const alias = resolveAlias(requestedAlias, config);
  const filePath = identityPathForAlias(ctx, alias);
  if (!fs.existsSync(filePath)) {
    fail(
      `Identity alias "${alias}" not found at ${filePath}. Register first with "identityapp register --as ${alias}".`,
    );
  }
  const credentials = loadCredentials(filePath);
  return { ...credentials, alias };
}

export function maybeSetDefaultAlias(
  ctx: RuntimeContext,
  config: IdentityConfig,
  alias: string,
) {
  if (!config.defaultAlias) {
    writeConfig(ctx, { ...config, defaultAlias: alias });
  }
}

export function redactPrivateKey(identity: Credentials) {
  return {
    ...identity,
    privateKey: "[redacted]",
  };
}
