// Short-lived storage for announcement settings and drafts that don't fit in a
// Discord custom id (100 character limit). Lives in memory, so it is lost on restart.
const stash = new Map();
const TTL_MS = 15 * 60 * 1000;

export function stashAnnouncement(payload, ttlMs = TTL_MS) {
  const key = Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  for (const [k, v] of stash) if (v.expiresAt < now) stash.delete(k);
  stash.set(key, { payload, ttlMs, expiresAt: now + ttlMs });
  return key;
}

/** Reads and removes the entry. */
export function takeAnnouncement(key) {
  const entry = stash.get(key);
  stash.delete(key);
  return entry && entry.expiresAt > Date.now() ? entry.payload : null;
}

/** Reads the entry and keeps it, pushing its expiry forward (used by drafts with several buttons). */
export function peekAnnouncement(key) {
  const entry = stash.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    stash.delete(key);
    return null;
  }
  entry.expiresAt = Date.now() + entry.ttlMs;
  return entry.payload;
}

export function dropAnnouncement(key) {
  stash.delete(key);
}
