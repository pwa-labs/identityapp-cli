import { canonicalize } from "json-canonicalize";
import { fail } from "./errors";

export { canonicalize };

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    fail("Body is not valid JSON");
  }
}
