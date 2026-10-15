import { getFromDb, setInDb } from '../utils/database.js';

const DEFAULTS = {
  url: 'https://grimempirecheats.com',
  tagline: 'Grim Empire Cheats',
  promoCode: 'EMPIRE30',
  promoPercent: 30,
  // ISO timestamp, or null for no end date.
  promoEndsAt: '2026-11-01T06:59:59Z',
};

export async function getStoreConfig(guildId) {
  const saved = await getFromDb(`store_config_${guildId}`, null);
  return { ...DEFAULTS, ...(saved || {}) };
}

export async function saveStoreConfig(guildId, config) {
  await setInDb(`store_config_${guildId}`, config);
}

export function promoIsActive(config, now = Date.now()) {
  if (!config.promoCode) return false;
  if (!config.promoEndsAt) return true;
  return new Date(config.promoEndsAt).getTime() > now;
}

/** One line the AI greeter and /store can both use. */
export function describePromo(config) {
  if (!promoIsActive(config)) return null;
  const ends = config.promoEndsAt
    ? ` until ${new Date(config.promoEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' })} (Pacific time)`
    : '';
  return `code ${config.promoCode} gives ${config.promoPercent}% off${ends}`;
}
