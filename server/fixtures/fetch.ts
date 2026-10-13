import fedexTrack from './fedex-track.doc.json';
import fedexNotFound from './fedex-notfound.doc.json';
import upsTrack from './ups-track.doc.json';
import fedexLive from './fedex-track.live.json';

/**
 * A fake `fetch` that answers FedEx/UPS endpoints from fixtures, so the real
 * adapters (OAuth + request + normalisation) run end-to-end with no keys.
 * Numbers ending in "0000" come back not-found; 123456789012 replays the
 * recorded FedEx sandbox response (fedex-track.live.json).
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const swap = <T>(doc: T, from: string, to: string): T => JSON.parse(JSON.stringify(doc).split(from).join(to));

export const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.pathname.endsWith('/oauth/token')) return json({ access_token: 'fixture-token', token_type: 'bearer', expires_in: 3599 });

  if (url.pathname === '/track/v1/trackingnumbers') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { trackingInfo: { trackingNumberInfo: { trackingNumber: string } }[] };
    const results = body.trackingInfo.map(({ trackingNumberInfo: { trackingNumber: n } }) =>
      n === '123456789012' ? fedexLive.output.completeTrackResults[0]
      : n.endsWith('0000')
        ? swap(fedexNotFound.output.completeTrackResults[0], '000000000000', n)
        : swap(fedexTrack.output.completeTrackResults[0], '123456789012', n));
    return json({ output: { completeTrackResults: results } });
  }

  const ups = url.pathname.match(/^\/api\/track\/v1\/details\/(.+)$/);
  if (ups) {
    const n = decodeURIComponent(ups[1]);
    if (n.endsWith('0000')) return json({ response: { errors: [{ code: 'TV1002', message: 'Tracking Information Not Found' }] } }, 404);
    return json(swap(upsTrack, '1Z999AA10123456784', n));
  }
  return json({ error: 'fixture: unknown endpoint' }, 404);
};
