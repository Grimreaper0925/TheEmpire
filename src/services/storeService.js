import { getFromDb, setInDb } from '../utils/database.js';

const DEFAULTS = {
  url: 'https://grimempirecheats.com',
  tagline: 'Grim Empire Cheats',
  promoCode: 'EMPIRE30',
  promoPercent: 30,
  // ISO timestamp, or null for no end date.
  promoEndsAt: '2026-11-01T06:59:59Z',
  vouchChannelId: null,
  salesChannelId: null,
  restockChannelId: null,
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

// 23:59:59 on the given calendar day in US Pacific time, as a Date (handles daylight saving).
export function endOfPacificDay(y, m, d) {
  const base = Date.UTC(y, m - 1, d, 23, 59, 59);
  if (new Date(base).getUTCMonth() !== m - 1) return null;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  for (const offsetHours of [7, 8]) {
    const candidate = new Date(base + offsetHours * 3600 * 1000);
    const parts = Object.fromEntries(fmt.formatToParts(candidate).map((p) => [p.type, p.value]));
    if (Number(parts.day) === d && Number(parts.month) === m && Number(parts.hour) % 24 === 23 && parts.minute === '59') {
      return candidate;
    }
  }
  return null;
}
