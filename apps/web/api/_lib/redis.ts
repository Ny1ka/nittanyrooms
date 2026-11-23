/**
 * Minimal Upstash Redis REST client (no SDK, so the function bundle stays small).
 * Works with Vercel's Upstash integration env vars (KV_REST_API_URL/TOKEN) or
 * Upstash's own (UPSTASH_REDIS_REST_URL/TOKEN).
 */
export type RedisCmd = (string | number)[];
export interface Redis {
  cmd: (...args: RedisCmd) => Promise<unknown>;
  pipeline: (cmds: RedisCmd[]) => Promise<unknown[]>;
}

export function redisFromEnv(env: Record<string, string | undefined>, f: typeof fetch = fetch): Redis | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const call = async (path: string, body: unknown) => {
    const res = await f(`${url}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    return res.json() as Promise<unknown>;
  };
  return {
    cmd: async (...args) => ((await call('', args)) as { result: unknown }).result,
    pipeline: async (cmds) => ((await call('/pipeline', cmds)) as { result: unknown }[]).map((r) => r.result),
  };
}
