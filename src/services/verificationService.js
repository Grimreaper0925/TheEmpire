import { randomInt } from 'crypto';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const CHALLENGE_TTL_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const MIN_ACCOUNT_AGE_MS = 0;

// userKey (guildId:userId) -> { answer, expiresAt, attempts }
const challenges = new Map();

function configKey(guildId) {
  return `verify_config_${guildId}`;
}

export async function getVerifyConfig(guildId) {
  return getFromDb(configKey(guildId), {
    roleId: null,
    verifyChannelId: null,
    welcomeChannelId: null,
    verifiedCount: 0,
  });
}

export async function saveVerifyConfig(guildId, config) {
  await setInDb(configKey(guildId), config);
}

export function createChallenge(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const existing = challenges.get(key);
  const attempts = existing && existing.expiresAt > Date.now() ? existing.attempts : 0;

  if (attempts >= MAX_ATTEMPTS) {
    return { locked: true };
  }

  const a = randomInt(2, 13);
  const b = randomInt(2, 13);
  const useMultiply = randomInt(0, 2) === 1;
  const question = useMultiply ? `What is ${a} x ${b}?` : `What is ${a} + ${b}?`;
  const answer = useMultiply ? a * b : a + b;

  challenges.set(key, { answer, expiresAt: Date.now() + CHALLENGE_TTL_MS, attempts });
  return { locked: false, question };
}

export function checkChallenge(guildId, userId, rawAnswer) {
  const key = `${guildId}:${userId}`;
  const entry = challenges.get(key);

  if (!entry || entry.expiresAt < Date.now()) {
    challenges.delete(key);
    return { ok: false, reason: 'expired' };
  }

  if (String(rawAnswer).trim() === String(entry.answer)) {
    challenges.delete(key);
    return { ok: true };
  }

  entry.attempts += 1;
  if (entry.attempts >= MAX_ATTEMPTS) {
    // Keep the entry so the lockout holds until it expires.
    entry.answer = null;
    return { ok: false, reason: 'locked' };
  }
  return { ok: false, reason: 'wrong', attemptsLeft: MAX_ATTEMPTS - entry.attempts };
}

export function accountIsOldEnough(user) {
  return Date.now() - user.createdTimestamp >= MIN_ACCOUNT_AGE_MS;
}

export async function grantVerifiedRole(member, config) {
  const role = member.guild.roles.cache.get(config.roleId) || (await member.guild.roles.fetch(config.roleId).catch(() => null));
  if (!role) {
    throw new Error('Verified role no longer exists. An admin needs to run /verifysetup again.');
  }

  if (member.roles.cache.has(role.id)) {
    return { alreadyVerified: true };
  }

  await member.roles.add(role, 'Passed human verification');

  try {
    const fresh = await getVerifyConfig(member.guild.id);
    fresh.verifiedCount = (fresh.verifiedCount || 0) + 1;
    await saveVerifyConfig(member.guild.id, fresh);
  } catch (error) {
    logger.warn('Could not update verified count', { error: error.message });
  }

  return { alreadyVerified: false };
}
