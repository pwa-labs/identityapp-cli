import fs from "node:fs";
import path from "node:path";
import { fail } from "./errors";

export function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
}

export function ensureDirForFile(filePath: string) {
  ensureDir(path.dirname(filePath));
}

export function readJsonFile(filePath: string): unknown {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      fail(`File not found: ${filePath}`);
    }
    fail(`Invalid JSON file: ${filePath}`);
  }
}

export function writeSecureJsonFile(filePath: string, value: unknown) {
  ensureDirForFile(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Ignore chmod issues on non-POSIX filesystems.
  }
}
