import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_BASE_URL } from "../constants";
import type { Credentials, RuntimeContext } from "../types";
import { generateEd25519KeyPair, minePowNonce, sha256Hex, signMessage } from "../lib/crypto";
import { fail } from "../lib/errors";
import { readJsonFile } from "../lib/fs";
import { readResponseJson, withBearer } from "../lib/http";
import {
  identityPathForAlias,
  loadCredentials,
  loadIdentityFromAlias,
  maybeSetDefaultAlias,
  readConfig,
  resolveAlias,
  saveCredentials,
} from "../lib/storage";
import { stripTrailingSlash } from "../lib/utils";

export async function handleRegister(args: string[], ctx: RuntimeContext) {
  const { values } = parseArgs({
    args,
    options: {
      as: { type: "string" },
      label: { type: "string" },
      "linking-key": { type: "string" },
      "no-link": { type: "boolean" },
      "key-file": { type: "string" },
      "public-key": { type: "string" },
      "private-key": { type: "string" },
      save: { type: "string" },
      url: { type: "string", default: DEFAULT_BASE_URL },
    },
    strict: true,
    allowPositionals: false,
  });
  const config = readConfig(ctx);
  const alias = resolveAlias(values.as, config);
  const canonicalPath = identityPathForAlias(ctx, alias);
  if (fs.existsSync(canonicalPath)) {
    fail(
      `Identity alias "${alias}" already exists at ${canonicalPath}. Register with a new alias or remove the existing one via "identityapp identity remove --as ${alias} --yes".`,
    );
  }

  let keyPair: { publicKey: string; privateKey: string };
  if (values["key-file"]) {
    const json = readJsonFile(values["key-file"]) as Partial<{
      publicKey: string;
      privateKey: string;
    }>;
    if (!json.publicKey || !json.privateKey) {
      fail('Key file must include "publicKey" and "privateKey"');
    }
    keyPair = { publicKey: json.publicKey, privateKey: json.privateKey };
  } else if (values["public-key"] && values["private-key"]) {
    console.error(
      "Warning: passing --private-key on the CLI exposes it in shell history. Prefer --key-file.",
    );
    keyPair = {
      publicKey: values["public-key"],
      privateKey: values["private-key"],
    };
  } else if (values["public-key"] || values["private-key"]) {
    fail("Both --public-key and --private-key must be set together");
  } else {
    keyPair = generateEd25519KeyPair();
  }

  console.error("Mining proof-of-work nonce...");
  const powNonce = minePowNonce(keyPair.publicKey);

  const payload: Record<string, unknown> = {
    publicKey: keyPair.publicKey,
    powNonce,
  };
  const label = values.label ?? alias;
  payload.label = label;

  const linkingKey =
    values["no-link"] === true
      ? undefined
      : values["linking-key"] ?? config.defaultLinkingKey ?? undefined;
  if (linkingKey) payload.linkingKey = linkingKey;

  const baseUrl = stripTrailingSlash(values.url);
  const response = await fetch(`${baseUrl}/api/v1/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await readResponseJson(response);
    fail(
      `Registration failed (${response.status}): ${(error as { error?: string }).error ?? "Unknown error"}`,
    );
  }

  const body = (await response.json()) as {
    did: string;
    linked: boolean;
    claimToken?: string;
  };
  const credentials: Credentials = {
    alias,
    did: body.did,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    linked: body.linked,
    claimToken: body.claimToken,
    label,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveCredentials(canonicalPath, credentials);
  maybeSetDefaultAlias(ctx, config, alias);
  console.error(`Identity saved to ${canonicalPath}`);

  if (values.save) {
    saveCredentials(path.resolve(values.save), credentials);
    console.error(`Additional copy saved to ${path.resolve(values.save)}`);
  }

  const registerOutput = {
    alias: credentials.alias,
    did: credentials.did,
    publicKey: credentials.publicKey,
    linked: credentials.linked,
    claimToken: credentials.claimToken,
    label: credentials.label,
    createdAt: credentials.createdAt,
    updatedAt: credentials.updatedAt,
    identityPath: canonicalPath,
    privateKey: "[stored locally only; never printed]",
  };
  console.log(JSON.stringify(registerOutput, null, 2));
}

export async function handleSign(args: string[], ctx: RuntimeContext) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      as: { type: "string" },
      file: { type: "string" },
      note: { type: "string" },
      credentials: { type: "string" },
      url: { type: "string", default: DEFAULT_BASE_URL },
    },
    strict: true,
    allowPositionals: true,
  });

  const payload = positionals[0];
  if (!payload && !values.file) {
    fail(
      "Usage: identityapp sign <payload> [--note <text>] [--credentials <path>] [--url <base_url>] OR identityapp sign --file <path> ...",
    );
  }

  const config = readConfig(ctx);
  const creds = values.credentials
    ? loadCredentials(path.resolve(values.credentials))
    : loadIdentityFromAlias(ctx, config, values.as);
  const content =
    values.file !== undefined
      ? fs.existsSync(values.file)
        ? fs.readFileSync(values.file)
        : fail(`File not found: ${values.file}`)
      : payload;
  const payloadHash = sha256Hex(content);
  const signedAt = Date.now();
  const signature = signMessage(creds.privateKey, `${payloadHash}:${signedAt}`);

  const response = await fetch(
    `${stripTrailingSlash(values.url)}/api/v1/signatures/sign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        did: creds.did,
        payloadHash,
        signature,
        signedAt,
        publicNote: values.note,
      }),
    },
  );
  if (!response.ok) {
    const error = await readResponseJson(response);
    fail(
      `Signing failed (${response.status}): ${(error as { error?: string }).error ?? "Unknown error"}`,
    );
  }
  const result = (await response.json()) as { signatureHash: string };
  const baseUrl = stripTrailingSlash(values.url);
  console.log(
    JSON.stringify(
      {
        ...result,
        verifyUrl: `${baseUrl}/verify/${result.signatureHash}`,
        verifyApiUrl: `${baseUrl}/api/v1/signatures/verify?hash=${result.signatureHash}`,
      },
      null,
      2,
    ),
  );
}

export async function handleVerify(
  args: string[],
  options?: {
    apiKey?: string;
  },
) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      url: { type: "string", default: DEFAULT_BASE_URL },
    },
    strict: true,
    allowPositionals: true,
  });
  const signatureHash = positionals[0];
  const contentToCheck = positionals[1];
  if (!signatureHash) {
    fail(
      "Usage: identityapp verify <signature_hash> [content_to_check] [--url <base_url>]",
    );
  }

  const headers: HeadersInit = {};
  if (options?.apiKey) Object.assign(headers, withBearer(options.apiKey));

  const response = await fetch(
    `${stripTrailingSlash(values.url)}/api/v1/signatures/verify?hash=${encodeURIComponent(signatureHash)}`,
    { headers },
  );
  if (!response.ok) {
    const error = await readResponseJson(response);
    fail(
      `Verification failed (${response.status}): ${(error as { error?: string }).error ?? "Unknown error"}`,
    );
  }
  const result = (await response.json()) as { payloadHash: string };
  const output =
    contentToCheck !== undefined
      ? {
          ...result,
          contentMatch: sha256Hex(contentToCheck) === result.payloadHash,
        }
      : result;
  console.log(JSON.stringify(output, null, 2));
}

export async function handleCertify(
  args: string[],
  options?: {
    apiKey?: string;
  },
) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      file: { type: "string" },
      url: { type: "string", default: DEFAULT_BASE_URL },
    },
    strict: true,
    allowPositionals: true,
  });
  const signatureHash = positionals[0];
  const contentArg = positionals[1];
  if (!signatureHash || (!contentArg && !values.file)) {
    fail(
      "Usage: identityapp certify <signature_hash> <content> [--url <base_url>] OR identityapp certify <signature_hash> --file <path> [--url <base_url>]",
    );
  }

  const content =
    values.file !== undefined
      ? fs.existsSync(values.file)
        ? fs.readFileSync(values.file)
        : fail(`File not found: ${values.file}`)
      : contentArg;
  const contentHash = sha256Hex(content);

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (options?.apiKey) Object.assign(headers, withBearer(options.apiKey));

  const response = await fetch(
    `${stripTrailingSlash(values.url)}/api/v1/signatures/certify`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ signatureHash, contentHash }),
    },
  );
  if (!response.ok) {
    const error = await readResponseJson(response);
    fail(
      `Certification failed (${response.status}): ${(error as { error?: string }).error ?? "Unknown error"}`,
    );
  }
  console.log(JSON.stringify(await response.json(), null, 2));
}

export async function handleReport(args: string[], ctx: RuntimeContext) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      as: { type: "string" },
      signature: { type: "string" },
      details: { type: "string" },
      credentials: { type: "string" },
      url: { type: "string", default: DEFAULT_BASE_URL },
    },
    strict: true,
    allowPositionals: true,
  });
  const targetDid = positionals[0];
  const reason = positionals[1];
  if (!targetDid || !reason) {
    fail(
      "Usage: identityapp report <target_did> <reason> [--signature <hash>] [--details <text>] [--credentials <path>] [--url <base_url>]",
    );
  }

  const validReasons = ["spam", "impersonation", "malicious", "other"];
  if (!validReasons.includes(reason)) {
    fail(
      `Invalid reason "${reason}". Must be one of: ${validReasons.join(", ")}`,
    );
  }

  const config = readConfig(ctx);
  const creds = values.credentials
    ? loadCredentials(path.resolve(values.credentials))
    : loadIdentityFromAlias(ctx, config, values.as);
  const signedAt = Date.now();
  const signature = signMessage(
    creds.privateKey,
    `report:${targetDid}:${reason}:${signedAt}`,
  );

  const response = await fetch(
    `${stripTrailingSlash(values.url)}/api/v1/agents/report`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        did: targetDid,
        reason,
        reporterDid: creds.did,
        signature,
        signedAt,
        signatureHash: values.signature,
        details: values.details,
      }),
    },
  );
  if (!response.ok) {
    const error = await readResponseJson(response);
    fail(
      `Report failed (${response.status}): ${(error as { error?: string }).error ?? "Unknown error"}`,
    );
  }
  console.log(JSON.stringify(await response.json(), null, 2));
}
