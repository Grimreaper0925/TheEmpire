// Pure date/time helpers for scheduled announcements. No Discord or database imports,
// so they can be tested on their own.

export const DEFAULT_TZ = process.env.ANNOUNCE_TIMEZONE || 'America/Los_Angeles';
export const REPEATS = ['none', 'daily', 'weekly'];

const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_AHEAD_MS = 30 * 1000;

export function tzLabel(tz = DEFAULT_TZ) {
  return tz === 'America/Los_Angeles' ? 'Pacific time' : tz;
}

function tzParts(ts, tz) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const parts = {};
  for (const p of formatter.formatToParts(new Date(ts))) if (p.type !== 'literal') parts[p.type] = Number(p.value);
  return parts;
}

function offsetAt(ts, tz) {
  const p = tzParts(ts, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000;
}

/** Wall-clock time in `tz` to a UTC timestamp. Returns null if that time doesn't exist (like Feb 30). */
export function zonedToUtc(year, month, day, hour, minute, tz = DEFAULT_TZ) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let ts = guess - offsetAt(guess, tz);
  ts = guess - offsetAt(ts, tz); // second pass handles daylight saving boundaries
  const back = tzParts(ts, tz);
  if (back.year !== year || back.month !== month || back.day !== day || back.hour !== hour || back.minute !== minute) return null;
  return ts;
}

function addDays({ year, month, day }, n) {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function parseClock(text) {
  const s = text.trim();
  if (s === 'noon') return { hour: 12, minute: 0 };
  if (s === 'midnight') return { hour: 0, minute: 0 };
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const suffix = m[3] ? m[3][0] : null;
  if (minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === 'p' && hour !== 12) hour += 12;
    if (suffix === 'a' && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute };
}

const REL_TOKEN = /(\d+)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m)\b/g;
const UNIT_MS = { d: 86400000, h: 3600000, m: 60000 };

/**
 * Understands: "in 2h", "1d 6h", "30m", "today 9pm", "tomorrow 6:30pm", "6pm" (next 6pm),
 * "2026-11-05 18:00", "11/5 6pm", "11/5/2026 18:00". Returns { ts } or { error }.
 */
export function parseWhen(input, { tz = DEFAULT_TZ, now = Date.now() } = {}) {
  let s = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return { error: 'Tell me when to post it, like `tomorrow 6pm`, `in 2h` or `2026-11-05 18:00`.' };

  // Relative: "in 2h", "1d 6h 30m"
  const relBody = s.replace(/^in\s+/, '');
  const tokens = [...relBody.matchAll(REL_TOKEN)];
  if (tokens.length && relBody.replace(REL_TOKEN, '').trim() === '') {
    const ms = tokens.reduce((sum, t) => sum + Number(t[1]) * UNIT_MS[t[2][0]], 0);
    return finish(now + ms, now);
  }

  s = s.replace(/\bat\b\s*/g, '').replace(/^(\S+)t(\d)/, '$1 $2').trim(); // "tomorrow at 6pm", "2026-11-05T18:00"
  const today = tzParts(now, tz);
  let date = null;
  let rest = s;
  let yearGiven = true;

  const keyword = rest.match(/^(today|tomorrow)\s*(.*)$/);
  const iso = rest.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s*(.*)$/);
  const us = rest.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(.*)$/);

  if (keyword) {
    date = addDays(today, keyword[1] === 'tomorrow' ? 1 : 0);
    rest = keyword[2];
  } else if (iso) {
    date = { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
    rest = iso[4];
  } else if (us) {
    yearGiven = Boolean(us[3]);
    const year = us[3] ? (us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3])) : today.year;
    date = { year, month: Number(us[1]), day: Number(us[2]) };
    rest = us[4];
  }

  const clock = parseClock(rest);
  if (!clock) {
    return { error: date ? 'I could not read the time. Try `6pm` or `18:30`.' : 'I could not read that. Try `tomorrow 6pm`, `in 2h` or `2026-11-05 18:00`.' };
  }

  let ts;
  if (date) {
    ts = zonedToUtc(date.year, date.month, date.day, clock.hour, clock.minute, tz);
    if (ts !== null && ts <= now && !yearGiven) ts = zonedToUtc(date.year + 1, date.month, date.day, clock.hour, clock.minute, tz);
  } else {
    // Time only: the next time the clock hits that.
    ts = zonedToUtc(today.year, today.month, today.day, clock.hour, clock.minute, tz);
    if (ts !== null && ts <= now) {
      const next = addDays(today, 1);
      ts = zonedToUtc(next.year, next.month, next.day, clock.hour, clock.minute, tz);
    }
  }
  if (ts === null) return { error: 'That date or time does not exist. Check the day and month.' };
  return finish(ts, now);
}

function finish(ts, now) {
  if (ts - now < MIN_AHEAD_MS) return { error: 'That time has already passed. Pick a time in the future.' };
  if (ts - now > MAX_AHEAD_MS) return { error: 'That is more than a year away. Pick a closer date.' };
  return { ts };
}

export function normalizeRepeat(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v || v === 'none' || v === 'no' || v === 'once' || v === 'never') return 'none';
  if (v === 'daily' || v === 'day' || v === 'every day') return 'daily';
  if (v === 'weekly' || v === 'week' || v === 'every week') return 'weekly';
  return null;
}

/** Same wall-clock time N days later, so a 6pm post stays at 6pm across daylight saving changes. */
export function nextOccurrence(runAt, repeat, tz = DEFAULT_TZ) {
  const step = repeat === 'weekly' ? 7 : 1;
  const p = tzParts(runAt, tz);
  const d = addDays(p, step);
  return zonedToUtc(d.year, d.month, d.day, p.hour, p.minute, tz) ?? runAt + step * 86400000;
}

/** Moves a repeating post forward until it is in the future (skips runs missed while the bot was down). */
export function advancePast(runAt, repeat, now = Date.now(), tz = DEFAULT_TZ) {
  let next = runAt;
  for (let i = 0; i < 800 && next <= now; i++) next = nextOccurrence(next, repeat, tz);
  return next;
}

export function describeRepeat(repeat) {
  return repeat === 'daily' ? 'every day' : repeat === 'weekly' ? 'every week' : 'one time';
}
