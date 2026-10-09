/** Server-only configuration. Nothing here is ever sent to the browser. */
export interface Env {
  APP_PASSCODE?: string;
  SESSION_SECRET?: string;
  FEDEX_API_KEY?: string;
  FEDEX_SECRET_KEY?: string;
  FEDEX_BASE_URL?: string; // default https://apis.fedex.com ; sandbox https://apis-sandbox.fedex.com
  UPS_CLIENT_ID?: string;
  UPS_CLIENT_SECRET?: string;
  UPS_BASE_URL?: string; // default https://onlinetools.ups.com ; test https://wwwcie.ups.com
  /** "1" → adapters answer from server/fixtures (local dev, demos, CI). */
  PG_FIXTURES?: string;
}

export const readEnv = (): Env => process.env as Env;
