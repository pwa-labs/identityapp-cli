export function usage() {
  return `
identityapp CLI

Usage:
  identityapp register [--as <alias>] [--label <name>] [--linking-key <key>] [--no-link] [--url <base_url>]
                       [--key-file <path>] [--public-key <b64> --private-key <b64>]
                       [--save <path>] [--home <dir>]
  identityapp sign <payload> [--as <alias>] [--note <text>] [--credentials <path>] [--url <base_url>] [--home <dir>]
  identityapp sign --file <path> [--as <alias>] [--note <text>] [--credentials <path>] [--url <base_url>] [--home <dir>]
  identityapp verify <signature_hash> [content_to_check] [--url <base_url>]
  identityapp certify <signature_hash> <content> [--url <base_url>]
  identityapp certify <signature_hash> --file <path> [--url <base_url>]
  identityapp report <target_did> <reason> [--as <alias>] [--signature <hash>] [--details <text>]
                     [--credentials <path>] [--url <base_url>] [--home <dir>]

  identityapp identity list [--home <dir>]
  identityapp identity show [--as <alias>] [--home <dir>]
  identityapp identity use <alias> [--home <dir>]
  identityapp identity remove --as <alias> --yes [--home <dir>]

  identityapp auth link set <linking_key> [--home <dir>]
  identityapp auth link show [--home <dir>]
  identityapp auth link clear [--home <dir>]

  identityapp integrator disclosure <slug> [--url <base_url>]
  identityapp integrator consent <allow|revoke> --as <alias> --integrator <slug>
                                 [--credentials <path>] [--url <base_url>] [--home <dir>]
  identityapp integrator ingest --api-key <key> [--ingest-url <full_url>] [--home <dir>]
                                (--body <json> | --body-file <path>)
  identityapp integrator verify <signature_hash> [content_to_check] --api-key <key> [--url <base_url>]
  identityapp integrator certify <signature_hash> <content> --api-key <key> [--url <base_url>]
  identityapp integrator certify <signature_hash> --file <path> --api-key <key> [--url <base_url>]

Examples:
  npx identityapp register --label "my-agent"
  npx identityapp sign "Hello world"
  npx identityapp verify <signatureHash> "Hello world"
  npx identityapp integrator ingest --api-key <key> --body-file ./event.json
  npx identityapp integrator disclosure my-platform
`.trim();
}
