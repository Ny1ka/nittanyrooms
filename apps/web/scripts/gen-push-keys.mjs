// Generates Web Push (VAPID) keys and a scheduler secret into apps/web/.env.push.local
// (git-ignored). Copy the values into Vercel env vars and the GitHub secret CRON_SECRET.
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as webpush from 'web-push';

const out = fileURLToPath(new URL('../.env.push.local', import.meta.url));
if (existsSync(out)) {
  console.log(`${out} already exists; not overwriting. Delete it to regenerate.`);
  process.exit(0);
}
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
writeFileSync(
  out,
  `# Generated ${new Date().toISOString()}. Keep private; do not commit.\nVAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nCRON_SECRET=${randomBytes(24).toString('base64url')}\n`,
  { mode: 0o600 },
);
console.log(`Wrote ${out} (values not printed).`);
