// Server layouts used by /aisetup.
// access: public | readonly-public | verified | readonly-verified | staff
// type:   text | voice | announcement (announcement falls back to text if the server isn't a Community server)

const STAFF_ROLE = { key: 'staff', name: 'Staff', color: 0xe74c3c, hoist: true, staff: true };
const VERIFIED_ROLE = { key: 'verified', name: 'Verified', color: 0x2ecc71, hoist: false };

const startHere = {
  name: 'START HERE',
  emoji: '📌',
  channels: [
    { name: 'welcome', emoji: '👋', access: 'readonly-public', topic: 'Welcome! Read the rules, then head to #verify to unlock the server.' },
    { name: 'rules', emoji: '📜', access: 'readonly-public', topic: 'Follow these rules or face a timeout, kick or ban.' },
    { name: 'verify', emoji: '✅', access: 'readonly-public', topic: 'Press the Verify button to get access to the rest of the server.' },
    { name: 'announcements', emoji: '📢', type: 'announcement', access: 'readonly-verified', topic: 'News and updates.' },
  ],
};

const staffArea = {
  name: 'STAFF',
  emoji: '🛡️',
  channels: [
    { name: 'staff-chat', emoji: '💬', access: 'staff', topic: 'Staff only.' },
    { name: 'staff-commands', emoji: '🤖', access: 'staff', topic: 'Run bot commands here.' },
    { name: 'mod-log', emoji: '📋', access: 'staff', topic: 'Moderation notes and logs.' },
    { name: 'Staff Room', emoji: '🔒', type: 'voice', access: 'staff' },
  ],
};

export const TEMPLATES = {
  store: {
    label: 'Store and community',
    blurb: 'Sales, giveaways, vouches and support, with everything locked until members verify.',
    roles: [STAFF_ROLE, VERIFIED_ROLE, { key: 'customer', name: 'Customer', color: 0xf1c40f, hoist: true }],
    categories: [
      startHere,
      {
        name: 'STORE',
        emoji: '🛒',
        channels: [
          { name: 'sales', emoji: '💸', access: 'readonly-verified', topic: 'Deals and discount codes.' },
          { name: 'store-updates', emoji: '🆕', access: 'readonly-verified', topic: 'New products and restocks.' },
          { name: 'giveaways', emoji: '🎁', access: 'readonly-verified', topic: 'Free stuff. Good luck!' },
          { name: 'vouches', emoji: '⭐', access: 'verified', topic: 'Bought something? Leave a vouch.' },
        ],
      },
      {
        name: 'SUPPORT',
        emoji: '🎫',
        channels: [
          { name: 'support', emoji: '🛟', access: 'verified', topic: 'Need help? Open a ticket or ask here.' },
          { name: 'faq', emoji: '❓', access: 'readonly-verified', topic: 'Answers to common questions.' },
          { name: 'bug-reports', emoji: '🐛', access: 'verified', topic: 'Something broken? Tell us.' },
        ],
      },
      {
        name: 'COMMUNITY',
        emoji: '💬',
        channels: [
          { name: 'general', emoji: '💬', access: 'verified', topic: 'Talk about anything.' },
          { name: 'media', emoji: '📸', access: 'verified', topic: 'Clips, screenshots and memes.' },
          { name: 'suggestions', emoji: '💡', access: 'verified', topic: 'Ideas for the server or store.' },
          { name: 'bot-commands', emoji: '🤖', access: 'verified', topic: 'Bot commands go here.' },
          { name: 'Lounge', emoji: '🔊', type: 'voice', access: 'verified' },
          { name: 'Hangout', emoji: '🎧', type: 'voice', access: 'verified' },
        ],
      },
      staffArea,
    ],
  },

  gaming: {
    label: 'Gaming community',
    blurb: 'Squad finding, clips, game chat and voice rooms.',
    roles: [STAFF_ROLE, VERIFIED_ROLE, { key: 'gamer', name: 'Gamer', color: 0x9b59b6, hoist: false }],
    categories: [
      startHere,
      {
        name: 'GENERAL',
        emoji: '💬',
        channels: [
          { name: 'general', emoji: '💬', access: 'verified', topic: 'Talk about anything.' },
          { name: 'introductions', emoji: '👤', access: 'verified', topic: 'Say hi and tell us what you play.' },
          { name: 'memes', emoji: '😂', access: 'verified', topic: 'Keep it fun.' },
          { name: 'bot-commands', emoji: '🤖', access: 'verified', topic: 'Bot commands go here.' },
        ],
      },
      {
        name: 'GAMING',
        emoji: '🎮',
        channels: [
          { name: 'game-chat', emoji: '🕹️', access: 'verified', topic: 'What are you playing?' },
          { name: 'looking-for-squad', emoji: '🤝', access: 'verified', topic: 'Find people to play with.' },
          { name: 'clips', emoji: '🎬', access: 'verified', topic: 'Your best plays.' },
          { name: 'game-news', emoji: '📰', access: 'readonly-verified', topic: 'Updates from the gaming world.' },
        ],
      },
      {
        name: 'VOICE',
        emoji: '🔊',
        channels: [
          { name: 'Lounge', emoji: '🛋️', type: 'voice', access: 'verified' },
          { name: 'Squad 1', emoji: '🎮', type: 'voice', access: 'verified' },
          { name: 'Squad 2', emoji: '🎮', type: 'voice', access: 'verified' },
          { name: 'Streaming', emoji: '📺', type: 'voice', access: 'verified' },
        ],
      },
      staffArea,
    ],
  },

  hangout: {
    label: 'Chill hangout',
    blurb: 'A simple friendly server: chat, pics, music and voice lounges. Open to everyone (no verify gate).',
    gated: false,
    roles: [STAFF_ROLE, { key: 'member', name: 'Member', color: 0x3498db, hoist: false }],
    categories: [
      {
        name: 'INFO',
        emoji: '📌',
        channels: [
          { name: 'welcome', emoji: '👋', access: 'readonly-public', topic: 'Welcome in!' },
          { name: 'rules', emoji: '📜', access: 'readonly-public', topic: 'Be kind. Have fun.' },
          { name: 'announcements', emoji: '📢', type: 'announcement', access: 'readonly-public', topic: 'News and updates.' },
        ],
      },
      {
        name: 'CHAT',
        emoji: '💬',
        channels: [
          { name: 'general', emoji: '💬', access: 'public', topic: 'Talk about anything.' },
          { name: 'pics', emoji: '📷', access: 'public', topic: 'Share photos.' },
          { name: 'memes', emoji: '😂', access: 'public', topic: 'Keep it fun.' },
          { name: 'music', emoji: '🎵', access: 'public', topic: 'Share songs.' },
          { name: 'Lounge', emoji: '🔊', type: 'voice', access: 'public' },
          { name: 'Chill Room', emoji: '🎧', type: 'voice', access: 'public' },
        ],
      },
      staffArea,
    ],
  },

  support: {
    label: 'Support desk',
    blurb: 'A help server: FAQ, help requests, status updates and a staff area. Locked until members verify.',
    roles: [STAFF_ROLE, VERIFIED_ROLE],
    categories: [
      startHere,
      {
        name: 'HELP',
        emoji: '🛟',
        channels: [
          { name: 'faq', emoji: '❓', access: 'readonly-verified', topic: 'Answers to common questions.' },
          { name: 'get-help', emoji: '🛟', access: 'verified', topic: 'Describe your problem and a staff member will help.' },
          { name: 'status', emoji: '📡', access: 'readonly-verified', topic: 'Outages, maintenance and fixes.' },
          { name: 'feedback', emoji: '💡', access: 'verified', topic: 'Tell us how we are doing.' },
        ],
      },
      {
        name: 'COMMUNITY',
        emoji: '💬',
        channels: [
          { name: 'general', emoji: '💬', access: 'verified', topic: 'Talk about anything.' },
          { name: 'bot-commands', emoji: '🤖', access: 'verified', topic: 'Bot commands go here.' },
        ],
      },
      staffArea,
    ],
  },
};
