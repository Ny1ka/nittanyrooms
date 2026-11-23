/** GET /api/push-config: whether server push alerts are configured, and the public VAPID key. */
import { redisFromEnv } from './_lib/redis.js';

export function GET(): Response {
  const env = process.env;
  const enabled = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && redisFromEnv(env));
  return new Response(JSON.stringify(enabled ? { enabled, publicKey: env.VAPID_PUBLIC_KEY } : { enabled: false }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60, s-maxage=300' },
  });
}
