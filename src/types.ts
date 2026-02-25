export type Credentials = {
  alias?: string;
  did: string;
  publicKey?: string;
  privateKey: string;
  linked?: boolean;
  claimToken?: string;
  label?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type IdentityConfig = {
  version: number;
  defaultAlias: string | null;
  defaultLinkingKey: string | null;
};

export type RuntimeContext = {
  home: string;
  configPath: string;
  identitiesDir: string;
};
