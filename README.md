# identityapp CLI

`identityapp` is a TypeScript CLI for interacting with identity.app as an agent or integrator.

## Install and run

```bash
# one-off
npx identityapp --help

# or global install
npm i -g identityapp
identityapp --help
```

## Commands

### Agent commands

- `identityapp register`
- `identityapp sign`
- `identityapp verify`
- `identityapp certify`
- `identityapp report`
- `identityapp identity list|show|use|remove`
- `identityapp auth link set|show|clear`

### Integrator commands

- `identityapp integrator consent`
- `identityapp integrator ingest`
- `identityapp integrator verify`
- `identityapp integrator certify`

## Examples

```bash
# Register identity alias and persist credentials under ~/.identity
npx identityapp register --as writer --label "writer"

# Sign and verify
npx identityapp sign --as writer "Hello world"
npx identityapp verify <signatureHash> "Hello world"

# Certify content
npx identityapp certify <signatureHash> "Hello world"

# Report a bad actor
npx identityapp report did:identity:badagent malicious --details "Scam attempts"
```

```bash
# Set a default linking key for future register calls
npx identityapp auth link set lk_abc123

# Register using default linking key
npx identityapp register --as support-bot

# Skip default linking key once
npx identityapp register --as experiment --no-link

# Set default alias so --as is optional later
npx identityapp identity use writer
npx identityapp sign "Message from default alias"
```

Register is intentionally non-destructive: if an alias already exists, registration fails.
Use a new alias, or explicitly remove the old one first:

```bash
npx identityapp identity remove --as writer --yes
```

## Human owner linking guidance

- If your human owner already has a linking key, set it once:

```bash
npx identityapp auth link set <linking_key>
```

- If they do not have one yet:
  - ask them to create/log into an account on `identity.app`
  - ask them to generate a linking key from the dashboard
  - then set it locally with the command above

- If linking is not ready yet:
  - register with `--no-link`
  - share the resulting claim token with the human owner for manual claiming later

```bash
# Integrator verify with consent context
npx identityapp integrator verify <signatureHash> --api-key <integratorApiKey>

# Ingest signals (bearer auth)
npx identityapp integrator ingest \
  --api-key <integratorApiKey> \
  --ingest-url https://integrator.identity.app/ingest \
  --body-file ./event.json
```

## Local development

```bash
npm install
npm run build
node bin/cli.mjs --help
```

## Publish

```bash
npm run build
npm publish --access public
```

The package uses a `bin` launcher (`bin/cli.mjs`) that executes the compiled output in `dist/`.

## Identity storage

- Default home directory: `~/.identity`
- Override with:
  - env var: `IDENTITY_HOME`
  - command flag: `--home <dir>`
- Layout:
  - `config.json` (default alias + default linking key)
  - `identities/<alias>.json` (private key + DID + metadata)
- Integrator ingest default endpoint: `https://integrator.identity.app/ingest` (override with `--ingest-url`)
