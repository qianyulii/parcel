/**
 * In-memory OAuth token cache, per credential set. Lives as long as the warm
 * serverless instance. Refreshes 5 minutes before expiry and de-duplicates
 * concurrent refreshes so a burst of /api/track calls asks for one token.
 */
export interface Token { accessToken: string; expiresAt: number }

const SKEW_MS = 5 * 60_000;

export class TokenCache {
  private tokens = new Map<string, Token>();
  private pending = new Map<string, Promise<Token>>();
  constructor(private now: () => number = Date.now) {}

  async get(key: string, fetchToken: () => Promise<{ accessToken: string; expiresInS: number }>): Promise<string> {
    const t = this.tokens.get(key);
    if (t && t.expiresAt - SKEW_MS > this.now()) return t.accessToken;
    let p = this.pending.get(key);
    if (!p) {
      p = fetchToken()
        .then(({ accessToken, expiresInS }) => {
          const tok = { accessToken, expiresAt: this.now() + expiresInS * 1000 };
          this.tokens.set(key, tok);
          return tok;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, p);
    }
    return (await p).accessToken;
  }

  invalidate(key: string) { this.tokens.delete(key); }
}

export const tokenCache = new TokenCache();
