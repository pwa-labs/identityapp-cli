import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_BASE_URL, DEFAULT_EVENTS_URL } from "../constants";
import type { RuntimeContext } from "../types";
import { sha256Hex, signMessage } from "../lib/crypto";
import { handleCertify, handleVerify } from "./agent";
import { fail } from "../lib/errors";
import { readResponseJson, withBearer } from "../lib/http";
import { loadCredentials, loadIdentityFromAlias, readConfig } from "../lib/storage";
import { canonicalize, parseJsonText, stripTrailingSlash } from "../lib/utils";

async function handleIntegratorConsent(args: string[], ctx: RuntimeContext) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      as: { type: "string" },
      credentials: { type: "string" },
      integrator: { type: "string" },
      url: { type: "string", default: DEFAULT_BASE_URL },
    },
    strict: true,
    allowPositionals: true,
  });

  const consentAction = positionals[0];
  if (consentAction !== "allow" && consentAction !== "revoke") {
    fail(
      "Usage: identityapp integrator consent <allow|revoke> --as <alias> --integrator <slug>",
    );
  }
  if (!values.integrator) {
    fail("Missing required flag: --integrator");
  }

  const config = readConfig(ctx);
  const creds = values.credentials
    ? loadCredentials(path.resolve(values.credentials))
    : loadIdentityFromAlias(ctx, config, values.as);

  const baseUrl = stripTrailingSlash(values.url);
  const signedAt = Date.now();

  const consentPayload = canonicalize({
    type: "integrator_consent_v1",
    did: creds.did,
    integratorSlug: values.integrator,
    action: consentAction,
    signedAt,
  });
  const payloadHash = sha256Hex(consentPayload);
  const signature = signMessage(creds.privateKey, `${payloadHash}:${signedAt}`);

  console.error("Signing consent payload...");
  const signResponse = await fetch(`${baseUrl}/api/v1/signatures/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      did: creds.did,
      payloadHash,
      signature,
      signedAt,
      publicNote: `integrator consent: ${consentAction} ${values.integrator}`,
    }),
  });
  if (!signResponse.ok) {
    const error = await readResponseJson(signResponse);
    fail(
      `Signing consent failed (${signResponse.status}): ${(error as { error?: string }).error ?? "Unknown error"}`,
    );
  }
  const { signatureHash } = (await signResponse.json()) as { signatureHash: string };

  console.error("Submitting consent...");
  const consentResponse = await fetch(`${baseUrl}/api/v1/integrators/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      integratorSlug: values.integrator,
      did: creds.did,
      action: consentAction,
      signatureHash,
      signedAt,
    }),
  });
  if (!consentResponse.ok) {
    const error = await readResponseJson(consentResponse);
    fail(
      `Consent update failed (${consentResponse.status}): ${(error as { error?: string }).error ?? "Unknown error"}`,
    );
  }
  console.log(JSON.stringify(await consentResponse.json(), null, 2));
}

async function handleIntegratorIngest(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      "api-key": { type: "string" },
      "ingest-url": { type: "string" },
      body: { type: "string" },
      "body-file": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values["api-key"]) {
    fail("Missing required flag: --api-key");
  }
  if (!values.body && !values["body-file"]) {
    fail("Provide one of --body or --body-file");
  }

  const jsonText = values["body-file"]
    ? fs.existsSync(values["body-file"])
      ? fs.readFileSync(values["body-file"], "utf-8")
      : fail(`File not found: ${values["body-file"]}`)
    : values.body!;

  parseJsonText(jsonText);

  const ingestUrl = values["ingest-url"] ?? DEFAULT_EVENTS_URL;
  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withBearer(values["api-key"]),
    },
    body: jsonText,
  });

  const body = await readResponseJson(response);
  if (!response.ok) {
    fail(
      `Ingest failed (${response.status}): ${(body as { error?: string }).error ?? "Unknown error"}`,
    );
  }
  console.log(JSON.stringify(body, null, 2));
}

function extractApiKey(tokens: string[]) {
  const out: string[] = [];
  let apiKey: string | undefined;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "--api-key") {
      apiKey = tokens[i + 1];
      i += 1;
      continue;
    }
    out.push(token);
  }
  return { apiKey, remaining: out };
}

export async function handleIntegrator(args: string[], ctx: RuntimeContext) {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (subcommand === "consent") {
    await handleIntegratorConsent(rest, ctx);
    return;
  }
  if (subcommand === "ingest") {
    await handleIntegratorIngest(rest);
    return;
  }
  if (subcommand === "verify") {
    const parsed = extractApiKey(rest);
    if (!parsed.apiKey) fail("Missing required flag: --api-key");
    await handleVerify(parsed.remaining, { apiKey: parsed.apiKey });
    return;
  }
  if (subcommand === "certify") {
    const parsed = extractApiKey(rest);
    if (!parsed.apiKey) fail("Missing required flag: --api-key");
    await handleCertify(parsed.remaining, { apiKey: parsed.apiKey });
    return;
  }

  fail("Usage: identityapp integrator <consent|ingest|verify|certify> ...");
}
