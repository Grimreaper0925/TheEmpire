import { getFromDb, setInDb } from '../utils/database.js';

const key = (guildId) => `vouches_${guildId}`;

export async function getVouchData(guildId) {
  const saved = await getFromDb(key(guildId), null);
  return { count: 0, total: 0, lastByUser: {}, recent: [], ...(saved && typeof saved === 'object' ? saved : {}) };
}

export async function addVouch(guildId, { userId, stars, message, product }) {
  const data = await getVouchData(guildId);
  data.count += 1;
  data.total += stars;
  data.lastByUser[userId] = Date.now();
  data.recent = [...data.recent, { n: data.count, userId, stars, message: message.slice(0, 300), product: product || '', at: Date.now() }].slice(-100);
  // Keep the per-user map from growing forever.
  const cutoff = Date.now() - 7 * 86400000;
  for (const [id, t] of Object.entries(data.lastByUser)) if (t < cutoff) delete data.lastByUser[id];
  await setInDb(key(guildId), data);
  return data;
}

export const average = (data) => (data.count ? data.total / data.count : 0);
export const starString = (n) => `${'⭐'.repeat(n)}${'▫️'.repeat(5 - n)}`;
