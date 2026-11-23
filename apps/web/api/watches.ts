/**
 * POST   /api/watches            create a push alert  → { id, token }
 * DELETE /api/watches?id=&token=  cancel it
 */
import { redisFromEnv } from './_lib/redis.js';
import { createWatch, deleteWatch } from './_lib/watches.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  const redis = redisFromEnv(process.env);
  if (!redis) return json({ error: 'push-not-configured' }, 503);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid-json' }, 400);
  }
  const r = await createWatch(redis, body);
  if ('error' in r) return json({ error: r.error }, r.status);
  return json({ id: r.id, token: r.token }, 201);
}

export async function DELETE(request: Request): Promise<Response> {
  const redis = redisFromEnv(process.env);
  if (!redis) return json({ error: 'push-not-configured' }, 503);
  const q = new URL(request.url).searchParams;
  const id = q.get('id') ?? '';
  const token = q.get('token') ?? '';
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id) || !token) return json({ error: 'bad-request' }, 400);
  return (await deleteWatch(redis, id, token)) ? json({ ok: true }) : json({ error: 'forbidden' }, 403);
}
