#!/usr/bin/env node

import { CURRENT_VERSION } from "./constants";
import { handleAuth } from "./commands/auth";
import {
  handleCertify,
  handleRegister,
  handleReport,
  handleSign,
  handleVerify,
} from "./commands/agent";
import { handleIdentity } from "./commands/identity";
import { handleIntegrator } from "./commands/integrator";
import { fail } from "./lib/errors";
import { createContext, resolveHome } from "./lib/storage";
import { usage } from "./usage";

async function main() {
  const parsed = resolveHome(process.argv.slice(2));
  const args = parsed.args;
  const ctx = createContext(parsed.home);
  const command = args[0];
  const rest = args.slice(1);

  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }
  if (command === "--version" || command === "-v") {
    console.log(CURRENT_VERSION);
    return;
  }

  if (command === "register") {
    await handleRegister(rest, ctx);
    return;
  }
  if (command === "sign") {
    await handleSign(rest, ctx);
    return;
  }
  if (command === "verify") {
    await handleVerify(rest);
    return;
  }
  if (command === "certify") {
    await handleCertify(rest);
    return;
  }
  if (command === "report") {
    await handleReport(rest, ctx);
    return;
  }
  if (command === "identity") {
    await handleIdentity(rest, ctx);
    return;
  }
  if (command === "auth") {
    await handleAuth(rest, ctx);
    return;
  }
  if (command === "integrator") {
    await handleIntegrator(rest, ctx);
    return;
  }

  fail(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Unknown error");
});
