/**
 * GET /api/check-watches   (Authorization: Bearer $CRON_SECRET)
 * Called every ~5 minutes by the GitHub Actions schedule (.github/workflows/watch-check.yml).
 */
import * as webpush from 'web-push';
import type { HandlerDeps } from './_lib/libcal.js';
import { redisFromEnv } from './_lib/redis.js';
import { checkWatches } from './_lib/watches.js';

const memo: NonNullable<HandlerDeps['memo']> = new Map();

export async function GET(request: Request): Promise<Response> {
  const env = process.env;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) return json({ error: 'unauthorized' }, 401);
  const redis = redisFromEnv(env);
  if (!redis || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return json({ error: 'push-not-configured' }, 503);
  const site = env.SITE_URL || 'https://nittanyrooms.vercel.app';
  webpush.setVapidDetails(site, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const result = await checkWatches(
    redis,
    { send: (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 3600, urgency: 'high' }) },
    { fetch, env, memo },
    site,
  );
  return json(result);
}
