/**
 * Web Push client: subscribe this browser and register alerts with /api/watches.
 * Only used when the server reports push is configured; otherwise the in-tab
 * watcher handles alerts on its own.
 */
let configPromise: Promise<{ enabled: boolean; publicKey?: string }> | null = null;

export function getPushConfig() {
  configPromise ??= fetch('/api/push-config')
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .catch(() => ({ enabled: false }));
  return configPromise;
}

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyToBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscription(publicKey: string): Promise<PushSubscriptionJSON> {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) as BufferSource }));
  return sub.toJSON();
}

export async function registerServerWatch(w: {
  roomId: string;
  roomName: string;
  buildingId: string;
  eid: string;
  date: string;
  after: number;
  minMinutes: number;
}): Promise<{ id: string; token: string } | null> {
  const cfg = await getPushConfig();
  if (!cfg.enabled || !cfg.publicKey || !pushSupported() || Notification.permission !== 'granted') return null;
  try {
    const sub = await subscription(cfg.publicKey);
    const res = await fetch('/api/watches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...w, subscription: sub }),
    });
    return res.ok ? ((await res.json()) as { id: string; token: string }) : null;
  } catch {
    return null;
  }
}

export function deleteServerWatch(server: { id: string; token: string } | undefined) {
  if (!server) return;
  void fetch(`/api/watches?${new URLSearchParams(server)}`, { method: 'DELETE' }).catch(() => {});
}
