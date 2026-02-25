---
name: agent-identity
description: Use identityapp CLI to register agents, sign and verify content, certify authenticity, report bad actors, and run integrator consent/ingest flows.
metadata:
  author: identityapp
  version: "0.1"
---

# Agent Identity

Use the `identityapp` npm CLI as the execution layer. This skill contains instructions only; it does not bundle scripts.

## Install

```bash
npx identityapp --help
```

If you prefer a global install:

```bash
npm i -g identityapp
identityapp --help
```

## Default behavior

- Default API base URL: `https://identity.app`
- Default identity home: `~/.identity`
- Credentials are stored per alias in `~/.identity/identities/<alias>.json`
- Most commands support `--url <base_url>` for non-production/dev usage
- Override identity home with `--home <dir>` or `IDENTITY_HOME=<dir>`

## Multi-identity model

- Use `--as <alias>` to choose which local identity performs an action.
- Set default alias:

```bash
npx identityapp identity use <alias>
```

- List/show stored identities:

```bash
npx identityapp identity list
npx identityapp identity show --as <alias>
```

## Agent workflow

### 1) Register

```bash
npx identityapp register --as writer --label "writer"
```

Register stores credentials in `~/.identity/identities/writer.json`.
If `writer` already exists, registration fails to protect the existing private key.

### 2) Sign

```bash
npx identityapp sign --as writer "Hello world" --note "demo"
```

Or sign a file:

```bash
npx identityapp sign --file ./message.txt
```

### 3) Verify

```bash
npx identityapp verify <signatureHash>
npx identityapp verify <signatureHash> "Hello world"
```

### 4) Certify

```bash
npx identityapp certify <signatureHash> "Hello world"
npx identityapp certify <signatureHash> --file ./message.txt
```

### 5) Report

```bash
npx identityapp report --as writer did:identity:badagent malicious --details "Scam attempts"
```

## Default linking key management

Set a linking key once and use it by default for future registrations:

```bash
npx identityapp auth link set <linking_key>
npx identityapp auth link show
```

`register` uses this key unless you pass `--no-link`:

```bash
npx identityapp register --as test-bot --no-link
```

## Human owner linking flow

If your human owner already has a linking key:

```bash
npx identityapp auth link set <linking_key>
```

If your human owner does not have a linking key yet:

1. Ask them to create/log into an account on `identity.app`.
2. Ask them to generate a linking key from their dashboard.
3. Once they share it, set it locally with:

```bash
npx identityapp auth link set <linking_key>
```

Fallback if linking is not ready yet:

- Register with `--no-link`.
- Then share the returned claim token with the human owner so they can claim the agent manually later.

## Integrator workflow

### 1) Set consent

```bash
npx identityapp integrator consent allow --as <alias> --integrator survaivor
```

Use `revoke` instead of `allow` to revoke. The command signs the consent payload and submits it in a single step.

### 2) Verify/certify with integrator context

```bash
npx identityapp integrator verify <signatureHash> --api-key <integratorApiKey>
npx identityapp integrator certify <signatureHash> "content" --api-key <integratorApiKey>
```

### 3) Ingest events

```bash
npx identityapp integrator ingest \
  --api-key <integratorApiKey> \
  --ingest-url https://integrator.identity.app/ingest \
  --body-file ./event.json
```

Notes:
- Ingest requests use `Authorization: Bearer <integratorApiKey>`.
- Default ingest endpoint is `https://integrator.identity.app/ingest` (override with `--ingest-url`).
- For `subjectType: "agent"`, ingest is deny-by-default unless consent is `allowed`.
