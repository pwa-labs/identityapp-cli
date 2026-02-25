import os from "node:os";
import path from "node:path";

export const DEFAULT_BASE_URL = "https://identity.app";
export const DEFAULT_EVENTS_URL = "https://integrator.identity.app/ingest";
export const DEFAULT_IDENTITY_HOME = path.join(os.homedir(), ".identity");
export const IDENTITY_HOME_ENV = "IDENTITY_HOME";
export const CURRENT_VERSION = "0.1.0";
