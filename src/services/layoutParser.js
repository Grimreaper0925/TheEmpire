// Turns plain text into a server layout for /aisetup custom.
//
//   Category name
//   - general
//   - announcements | read
//   - staff-chat | staff
//   - Lounge | voice
//
// Flags after "|": read (members can read but not talk), staff, voice, public, news.

const STAFF_ROLE = { key: 'staff', name: 'Staff', color: 0xe74c3c, hoist: true, staff: true };
const VERIFIED_ROLE = { key: 'verified', name: 'Verified', color: 0x2ecc71, hoist: false };
const CATEGORY_EMOJI = ['📌', '💬', '🎮', '🛒', '🎫', '📚', '🎵', '🔊'];

export const MAX_CUSTOM_CATEGORIES = 10;
export const MAX_CUSTOM_CHANNELS = 60;

export function parseLayout(input) {
  const categories = [];
  const errors = [];
  let current = null;
  let channelCount = 0;

  for (const raw of String(input).split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    if (/^[-*•]/.test(line)) {
      if (!current) {
        errors.push(`"${line}" has no category above it.`);
        continue;
      }
      const [namePart, ...flagParts] = line.replace(/^[-*•]\s*/, '').split('|');
      const name = namePart.trim().replace(/^#/, '').slice(0, 80);
      if (!name) continue;
      const flags = flagParts.join(' ').toLowerCase().split(/[\s,]+/).filter(Boolean);

      let access = 'verified';
      if (flags.includes('public')) access = 'public';
      if (flags.includes('read') || flags.includes('readonly')) access = flags.includes('public') ? 'readonly-public' : 'readonly-verified';
      if (flags.includes('staff')) access = 'staff';

      const isVoice = flags.includes('voice');
      const isNews = flags.includes('news') || flags.includes('announce');
      current.channels.push({
        name,
        emoji: isVoice ? '🔊' : isNews ? '📢' : '💬',
        type: isVoice ? 'voice' : isNews ? 'announcement' : 'text',
        access: isVoice && access.startsWith('readonly') ? 'verified' : access,
        topic: '',
      });
      channelCount++;
    } else {
      if (categories.length >= MAX_CUSTOM_CATEGORIES) {
        errors.push(`Only ${MAX_CUSTOM_CATEGORIES} categories are allowed.`);
        break;
      }
      current = { name: line.replace(/^#+\s*/, '').toUpperCase().slice(0, 60), emoji: CATEGORY_EMOJI[categories.length % CATEGORY_EMOJI.length], channels: [] };
      categories.push(current);
    }
  }

  const usable = categories.filter((c) => c.channels.length);
  if (!usable.length) errors.push('I did not find any channels. Put a category name on its own line, then channels starting with "-".');
  if (channelCount > MAX_CUSTOM_CHANNELS) errors.push(`That is ${channelCount} channels. The limit is ${MAX_CUSTOM_CHANNELS}.`);

  return {
    errors,
    template: {
      label: 'Custom layout',
      blurb: 'Built from the text you typed.',
      roles: [STAFF_ROLE, VERIFIED_ROLE],
      categories: usable,
    },
  };
}
