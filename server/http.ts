export class UpstreamError extends Error {
  constructor(public status: number, public body: string, public retryAfterS?: number) {
    super(`upstream ${status}`);
  }
}

export interface FetchOpts extends RequestInit { timeoutMs?: number; retries?: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with a timeout and small exponential backoff on 429 / 5xx / network errors. */
export async function fetchJson<T = unknown>(url: string, opts: FetchOpts = {}, fetcher: typeof fetch = fetch): Promise<T> {
  const { timeoutMs = 10_000, retries = 2, ...init } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetcher(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      if (res.ok) return (text ? JSON.parse(text) : {}) as T;
      const ra = Number(res.headers.get('retry-after')) || undefined;
      const err = new UpstreamError(res.status, text.slice(0, 2000), ra);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        lastErr = err;
        await sleep(Math.min(ra ? ra * 1000 : 400 * 2 ** attempt, 4000));
        continue;
      }
      throw err;
    } catch (e) {
      if (e instanceof UpstreamError) throw e;
      lastErr = e;
      if (attempt < retries) { await sleep(400 * 2 ** attempt); continue; }
    }
  }
  throw lastErr;
}
