// Server layouts used by /aisetup.
// access: public | readonly-public | verified | readonly-verified | staff
// type:   text | voice | announcement (announcement falls back to text if the server isn't a Community server)
// Template flags: gated (default true), selfRoles (adds pick-your-roles panel), tickets (adds a ticket category and panel)

const STAFF_ROLE = { key: 'staff', name: 'Staff', color: 0xe74c3c, hoist: true, staff: true };
const VERIFIED_ROLE = { key: 'verified', name: 'Verified', color: 0x2ecc71, hoist: false };

const text = (name, emoji, access, topic) => ({ name, emoji, access, topic });
const voice = (name, emoji, access = 'verified') => ({ name, emoji, type: 'voice', access });
const news = (name, emoji, access, topic) => ({ name, emoji, type: 'announcement', access, topic });

const startHere = {
  name: 'START HERE',
  emoji: '📌',
  channels: [
    text('welcome', '👋', 'readonly-public', 'Welcome! Read the rules, then head to #verify to unlock the server.'),
    text('rules', '📜', 'readonly-public', 'Follow these rules or face a timeout, kick or ban.'),
    text('verify', '✅', 'readonly-public', 'Press the Verify button to get access to the rest of the server.'),
    news('announcements', '📢', 'readonly-verified', 'News and updates.'),
    text('get-roles', '🎭', 'readonly-verified', 'Pick your ping roles and name color.'),
  ],
};

const staffArea = {
  name: 'STAFF',
  emoji: '🛡️',
  channels: [
    text('staff-chat', '💬', 'staff', 'Staff only.'),
    text('staff-commands', '🤖', 'staff', 'Run bot commands here.'),
    text('mod-log', '📋', 'staff', 'Moderation notes, ticket transcripts and ratings.'),
    voice('Staff Room', '🔒', 'staff'),
  ],
};

const ticketCategory = { name: 'TICKETS', emoji: '🎫' };

export const TEMPLATES = {
  store: {
    label: 'Store and community',
    blurb: 'Sales, giveaways, vouches and support tickets, with everything locked until members verify.',
    store: true,
    selfRoles: true,
    tickets: true,
    ticketCategory,
    roles: [STAFF_ROLE, VERIFIED_ROLE, { key: 'customer', name: 'Customer', color: 0xf1c40f, hoist: true }],
    categories: [
      startHere,
      {
        name: 'STORE', emoji: '🛒',
        channels: [
          text('sales', '💸', 'readonly-verified', 'Deals and discount codes.'),
          text('store-updates', '🆕', 'readonly-verified', 'New products and restocks.'),
          text('giveaways', '🎁', 'readonly-verified', 'Free stuff. Good luck!'),
          text('vouches', '⭐', 'verified', 'Bought something? Leave a vouch with /vouch.'),
        ],
      },
      {
        name: 'SUPPORT', emoji: '🎫',
        channels: [
          text('support', '🛟', 'readonly-verified', 'Need help? Use the menu below to open a private ticket.'),
          text('faq', '❓', 'readonly-verified', 'Answers to common questions.'),
          text('bug-reports', '🐛', 'verified', 'Something broken? Tell us.'),
        ],
      },
      {
        name: 'COMMUNITY', emoji: '💬',
        channels: [
          text('general', '💬', 'verified', 'Talk about anything.'),
          text('media', '📸', 'verified', 'Clips, screenshots and memes.'),
          text('suggestions', '💡', 'verified', 'Ideas for the server or store.'),
          text('bot-commands', '🤖', 'verified', 'Bot commands go here.'),
          voice('Lounge', '🔊'),
          voice('Hangout', '🎧'),
        ],
      },
      staffArea,
    ],
  },

  gaming: {
    label: 'Gaming community',
    blurb: 'Squad finding, clips, game chat and voice rooms.',
    selfRoles: true,
    roles: [STAFF_ROLE, VERIFIED_ROLE, { key: 'gamer', name: 'Gamer', color: 0x9b59b6, hoist: false }],
    categories: [
      startHere,
      {
        name: 'GENERAL', emoji: '💬',
        channels: [
          text('general', '💬', 'verified', 'Talk about anything.'),
          text('introductions', '👤', 'verified', 'Say hi and tell us what you play.'),
          text('memes', '😂', 'verified', 'Keep it fun.'),
          text('bot-commands', '🤖', 'verified', 'Bot commands go here.'),
        ],
      },
      {
        name: 'GAMING', emoji: '🎮',
        channels: [
          text('game-chat', '🕹️', 'verified', 'What are you playing?'),
          text('looking-for-squad', '🤝', 'verified', 'Find people to play with.'),
          text('clips', '🎬', 'verified', 'Your best plays.'),
          text('game-news', '📰', 'readonly-verified', 'Updates from the gaming world.'),
        ],
      },
      {
        name: 'VOICE', emoji: '🔊',
        channels: [voice('Lounge', '🛋️'), voice('Squad 1', '🎮'), voice('Squad 2', '🎮'), voice('Streaming', '📺')],
      },
      staffArea,
    ],
  },

  esports: {
    label: 'Esports team',
    blurb: 'Roster, scrims, strategy and match results, with team voice rooms.',
    selfRoles: true,
    roles: [STAFF_ROLE, VERIFIED_ROLE, { key: 'player', name: 'Player', color: 0xe67e22, hoist: true }, { key: 'coach', name: 'Coach', color: 0x1abc9c, hoist: true }],
    categories: [
      startHere,
      {
        name: 'TEAM', emoji: '🏆',
        channels: [
          text('roster', '📋', 'readonly-verified', 'Current players and roles.'),
          text('schedule', '📅', 'readonly-verified', 'Practice times and match days.'),
          text('match-results', '🥇', 'readonly-verified', 'Scores and highlights.'),
          text('scrim-requests', '⚔️', 'verified', 'Find teams to scrim.'),
        ],
      },
      {
        name: 'STRATEGY', emoji: '🧠',
        channels: [
          text('strategy', '🗺️', 'verified', 'Tactics and plans.'),
          text('vod-review', '🎞️', 'verified', 'Review matches and clips.'),
          text('general', '💬', 'verified', 'Talk about anything.'),
        ],
      },
      { name: 'VOICE', emoji: '🔊', channels: [voice('Team Comms', '🎙️'), voice('Scrim Room', '⚔️'), voice('Lounge', '🛋️')] },
      staffArea,
    ],
  },

  creator: {
    label: 'Creator and streamer',
    blurb: 'Stream alerts, clips, fan art and a community space for your viewers.',
    selfRoles: true,
    roles: [STAFF_ROLE, VERIFIED_ROLE, { key: 'subscriber', name: 'Supporter', color: 0xff69b4, hoist: true }],
    categories: [
      startHere,
      {
        name: 'CHANNEL', emoji: '🎥',
        channels: [
          text('stream-alerts', '🔴', 'readonly-verified', 'Go-live alerts and schedule changes.'),
          text('schedule', '📅', 'readonly-verified', 'When the next stream is.'),
          text('clips', '🎬', 'verified', 'Best moments from the channel.'),
          text('fan-art', '🎨', 'verified', 'Art made by the community.'),
        ],
      },
      {
        name: 'COMMUNITY', emoji: '💬',
        channels: [
          text('general', '💬', 'verified', 'Talk about anything.'),
          text('memes', '😂', 'verified', 'Keep it fun.'),
          text('suggestions', '💡', 'verified', 'Ideas for streams and content.'),
          text('bot-commands', '🤖', 'verified', 'Bot commands go here.'),
          voice('Lounge', '🛋️'),
          voice('Watch Party', '📺'),
        ],
      },
      staffArea,
    ],
  },

  marketplace: {
    label: 'Marketplace and trading',
    blurb: 'Listings, requests, vouches and tickets for deals, with safety rules built in.',
    selfRoles: true,
    tickets: true,
    ticketCategory,
    roles: [STAFF_ROLE, VERIFIED_ROLE, { key: 'trusted', name: 'Trusted Trader', color: 0xf1c40f, hoist: true }],
    categories: [
      startHere,
      {
        name: 'MARKET', emoji: '🏪',
        channels: [
          text('listings', '📦', 'verified', 'Post what you are selling.'),
          text('requests', '🔎', 'verified', 'Post what you are looking for.'),
          text('vouches', '⭐', 'verified', 'Finished a deal? Leave a vouch with /vouch.'),
          text('scam-alerts', '🚨', 'readonly-verified', 'Known scammers and safety warnings.'),
        ],
      },
      {
        name: 'SUPPORT', emoji: '🎫',
        channels: [
          text('support', '🛟', 'readonly-verified', 'Dispute or need help? Open a private ticket below.'),
          text('faq', '❓', 'readonly-verified', 'Answers to common questions.'),
        ],
      },
      { name: 'COMMUNITY', emoji: '💬', channels: [text('general', '💬', 'verified', 'Talk about anything.'), text('bot-commands', '🤖', 'verified', 'Bot commands go here.'), voice('Lounge', '🛋️')] },
      staffArea,
    ],
  },

  roleplay: {
    label: 'Roleplay',
    blurb: 'Lore, character sheets, in-character scenes and out-of-character chat.',
    selfRoles: true,
    roles: [STAFF_ROLE, VERIFIED_ROLE, { key: 'rper', name: 'Roleplayer', color: 0x9b59b6, hoist: true }],
    categories: [
      startHere,
      {
        name: 'LORE', emoji: '📖',
        channels: [
          text('world-lore', '🌍', 'readonly-verified', 'The world and its history.'),
          text('character-sheets', '🧾', 'verified', 'Post your character sheet.'),
          text('applications', '📝', 'verified', 'Apply for roles and factions.'),
        ],
      },
      {
        name: 'IN CHARACTER', emoji: '🎭',
        channels: [
          text('tavern', '🍺', 'verified', 'Open scene. Stay in character.'),
          text('market-square', '🛍️', 'verified', 'Open scene. Stay in character.'),
          text('adventure', '⚔️', 'verified', 'Quests and story events.'),
        ],
      },
      {
        name: 'OUT OF CHARACTER', emoji: '💬',
        channels: [text('ooc-chat', '💬', 'verified', 'Talk as yourself.'), text('bot-commands', '🤖', 'verified', 'Bot commands go here.'), voice('Table Talk', '🎲')],
      },
      staffArea,
    ],
  },

  study: {
    label: 'Study group',
    blurb: 'Subject channels, quiet study rooms, resources and a homework help desk.',
    selfRoles: true,
    roles: [STAFF_ROLE, VERIFIED_ROLE, { key: 'tutor', name: 'Tutor', color: 0x3498db, hoist: true }],
    categories: [
      startHere,
      {
        name: 'STUDY', emoji: '📚',
        channels: [
          text('resources', '🔖', 'readonly-verified', 'Useful links, notes and guides.'),
          text('homework-help', '🙋', 'verified', 'Ask questions here.'),
          text('math', '➗', 'verified', 'Math help and talk.'),
          text('science', '🔬', 'verified', 'Science help and talk.'),
          text('writing', '✍️', 'verified', 'Essays and writing feedback.'),
          text('goals', '🎯', 'verified', 'Share what you plan to get done.'),
        ],
      },
      { name: 'COMMUNITY', emoji: '💬', channels: [text('general', '💬', 'verified', 'Talk about anything.'), text('bot-commands', '🤖', 'verified', 'Bot commands go here.')] },
      { name: 'VOICE', emoji: '🔊', channels: [voice('Quiet Study 1', '🤫'), voice('Quiet Study 2', '🤫'), voice('Group Study', '👥'), voice('Break Room', '☕')] },
      staffArea,
    ],
  },

  hangout: {
    label: 'Chill hangout',
    blurb: 'A simple friendly server: chat, pics, music and voice lounges. Open to everyone (no verify gate).',
    gated: false,
    selfRoles: true,
    roles: [STAFF_ROLE, { key: 'member', name: 'Member', color: 0x3498db, hoist: false }],
    categories: [
      {
        name: 'INFO', emoji: '📌',
        channels: [
          text('welcome', '👋', 'readonly-public', 'Welcome in!'),
          text('rules', '📜', 'readonly-public', 'Be kind. Have fun.'),
          news('announcements', '📢', 'readonly-public', 'News and updates.'),
          text('get-roles', '🎭', 'readonly-public', 'Pick your ping roles and name color.'),
        ],
      },
      {
        name: 'CHAT', emoji: '💬',
        channels: [
          text('general', '💬', 'public', 'Talk about anything.'),
          text('pics', '📷', 'public', 'Share photos.'),
          text('memes', '😂', 'public', 'Keep it fun.'),
          text('music', '🎵', 'public', 'Share songs.'),
          voice('Lounge', '🔊', 'public'),
          voice('Chill Room', '🎧', 'public'),
        ],
      },
      staffArea,
    ],
  },

  support: {
    label: 'Support desk',
    blurb: 'A help server with a ticket system, FAQ and status updates. Locked until members verify.',
    selfRoles: true,
    tickets: true,
    ticketCategory,
    roles: [STAFF_ROLE, VERIFIED_ROLE],
    categories: [
      startHere,
      {
        name: 'HELP', emoji: '🛟',
        channels: [
          text('faq', '❓', 'readonly-verified', 'Answers to common questions.'),
          text('support', '🛟', 'readonly-verified', 'Need help? Use the menu below to open a private ticket.'),
          text('status', '📡', 'readonly-verified', 'Outages, maintenance and fixes.'),
          text('feedback', '💡', 'verified', 'Tell us how we are doing.'),
        ],
      },
      { name: 'COMMUNITY', emoji: '💬', channels: [text('general', '💬', 'verified', 'Talk about anything.'), text('bot-commands', '🤖', 'verified', 'Bot commands go here.')] },
      staffArea,
    ],
  },
};
