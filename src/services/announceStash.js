// Short-lived storage for announcement settings (style, image, button) that
// don't fit in a Discord modal custom id (100 character limit).
const stash = new Map();
const TTL_MS = 15 * 60 * 1000;

export function stashAnnouncement(payload) {
  const key = Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  for (const [k, v] of stash) if (v.expiresAt < now) stash.delete(k);
  stash.set(key, { payload, expiresAt: now + TTL_MS });
  return key;
}

export function takeAnnouncement(key) {
  const entry = stash.get(key);
  stash.delete(key);
  return entry && entry.expiresAt > Date.now() ? entry.payload : null;
}
