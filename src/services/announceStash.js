// Short-lived storage for an announcement image URL, because Discord modal
// custom ids are too short to carry a full attachment URL.
const stashedImages = new Map();
const TTL_MS = 15 * 60 * 1000;

export function stashImage(url) {
  const key = Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  for (const [k, v] of stashedImages) if (v.expiresAt < now) stashedImages.delete(k);
  stashedImages.set(key, { url, expiresAt: now + TTL_MS });
  return key;
}

export function takeStashedImage(key) {
  const entry = stashedImages.get(key);
  stashedImages.delete(key);
  return entry && entry.expiresAt > Date.now() ? entry.url : null;
}
