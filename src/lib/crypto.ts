import crypto from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function buildPrivateKeyFromRawBase64(privateKeyBase64: string) {
  const raw = Buffer.from(privateKeyBase64, "base64");
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const der = Buffer.concat([pkcs8Prefix, raw]);
  return crypto.createPrivateKey({
    key: der,
    format: "der",
    type: "pkcs8",
  });
}

export function signMessage(privateKeyBase64: string, message: string): string {
  const privateKey = buildPrivateKeyFromRawBase64(privateKeyBase64);
  return crypto.sign(null, Buffer.from(message), privateKey).toString("base64");
}

export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyB64 = publicKey
    .export({ type: "spki", format: "der" })
    .subarray(-32)
    .toString("base64");
  const privateKeyB64 = privateKey
    .export({ type: "pkcs8", format: "der" })
    .subarray(-32)
    .toString("base64");
  return { publicKey: publicKeyB64, privateKey: privateKeyB64 };
}

export function minePowNonce(publicKey: string, difficulty = 4): string {
  let nonce = 0;
  const prefix = "0".repeat(difficulty);
  while (true) {
    const hash = sha256Hex(`${publicKey}${String(nonce)}`);
    if (hash.startsWith(prefix)) return String(nonce);
    nonce += 1;
  }
}
