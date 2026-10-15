// Question banks for the party games. Each trivia entry lists the correct answer first; the game shuffles them.

export const TRIVIA = [
  // gaming
  { c: 'Gaming', q: 'Which company created the Mario franchise?', a: ['Nintendo', 'Sega', 'Sony', 'Atari'] },
  { c: 'Gaming', q: 'In Minecraft, which green mob explodes when it gets close to you?', a: ['Creeper', 'Zombie', 'Skeleton', 'Enderman'] },
  { c: 'Gaming', q: 'Which game features a flying Battle Bus that drops players onto an island?', a: ['Fortnite', 'Apex Legends', 'PUBG', 'Warzone'] },
  { c: 'Gaming', q: 'What color is Pac-Man?', a: ['Yellow', 'Red', 'Blue', 'Green'] },
  { c: 'Gaming', q: 'In The Legend of Zelda, what is the name of the princess?', a: ['Zelda', 'Peach', 'Samus', 'Daisy'] },
  { c: 'Gaming', q: 'What is the name of Sonic\'s two-tailed fox friend?', a: ['Tails', 'Knuckles', 'Shadow', 'Amy'] },
  { c: 'Gaming', q: 'In Among Us, what are the players who secretly sabotage the crew called?', a: ['Impostors', 'Crewmates', 'Ghosts', 'Hunters'] },
  { c: 'Gaming', q: 'What does "GG" stand for?', a: ['Good game', 'Go get', 'Great gear', 'Game guide'] },
  { c: 'Gaming', q: 'Which game series stars a super soldier called Master Chief?', a: ['Halo', 'Gears of War', 'Doom', 'Destiny'] },
  { c: 'Gaming', q: 'How many players are on a team in a standard Valorant match?', a: ['5', '4', '6', '3'] },
  { c: 'Gaming', q: 'In Counter-Strike bomb maps, what must the Terrorists do?', a: ['Plant the bomb', 'Rescue hostages', 'Capture a flag', 'Escort a payload'] },
  { c: 'Gaming', q: 'What do you collect in Sonic the Hedgehog to stay alive?', a: ['Rings', 'Coins', 'Stars', 'Gems'] },
  // general
  { c: 'General', q: 'How many continents are there?', a: ['7', '5', '6', '8'] },
  { c: 'General', q: 'Which planet is the largest in our solar system?', a: ['Jupiter', 'Saturn', 'Neptune', 'Earth'] },
  { c: 'General', q: 'How many minutes are in one day?', a: ['1440', '1240', '1400', '2400'] },
  { c: 'General', q: 'Which ocean is the largest?', a: ['Pacific', 'Atlantic', 'Indian', 'Arctic'] },
  { c: 'General', q: 'What is the chemical symbol for gold?', a: ['Au', 'Ag', 'Gd', 'Go'] },
  { c: 'General', q: 'How many sides does a hexagon have?', a: ['6', '5', '7', '8'] },
  { c: 'General', q: 'What is the capital of Japan?', a: ['Tokyo', 'Kyoto', 'Osaka', 'Seoul'] },
  { c: 'General', q: 'Which planet is known as the Red Planet?', a: ['Mars', 'Venus', 'Mercury', 'Jupiter'] },
  { c: 'General', q: 'What is the fastest land animal?', a: ['Cheetah', 'Lion', 'Horse', 'Greyhound'] },
  { c: 'General', q: 'How many players per team are on the field in soccer?', a: ['11', '9', '10', '12'] },
  { c: 'General', q: 'Which gas do plants take in from the air?', a: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'] },
  { c: 'General', q: 'Who painted the Mona Lisa?', a: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Picasso'] },
  { c: 'General', q: 'Which country is home to kangaroos in the wild?', a: ['Australia', 'Brazil', 'India', 'Canada'] },
  { c: 'General', q: 'What is 12 x 12?', a: ['144', '124', '132', '156'] },
  // tech
  { c: 'Tech', q: 'What does CPU stand for?', a: ['Central Processing Unit', 'Computer Power Unit', 'Core Program Utility', 'Central Program Usage'] },
  { c: 'Tech', q: 'How many bits are in a byte?', a: ['8', '4', '16', '10'] },
  { c: 'Tech', q: 'Which language is mainly used to style web pages?', a: ['CSS', 'SQL', 'Python', 'Java'] },
  { c: 'Tech', q: 'In what year did the first iPhone launch?', a: ['2007', '2005', '2009', '2010'] },
];

export const WOULD_YOU_RATHER = [
  ['Have unlimited game keys', 'Have a gaming PC that never lags'],
  ['Be the best player in any game you try', 'Always get legendary loot drops'],
  ['Play only single-player games forever', 'Play only multiplayer games forever'],
  ['Never lose another 1v1', 'Never lag again'],
  ['Have a pet dragon', 'Have a pet robot'],
  ['Live in a video game world', 'Have video game powers in the real world'],
  ['Always be the last one alive but win', 'Always get first place but with no kills'],
  ['Have a pause button for real life', 'Have a rewind button for real life'],
  ['Only eat pizza for a year', 'Only eat tacos for a year'],
  ['Be able to fly', 'Be able to turn invisible'],
  ['Have the fastest internet in the world', 'Have the best graphics card in the world'],
  ['Stream to 1 million viewers once', 'Have 1,000 loyal viewers every day'],
  ['Never need to sleep', 'Never need to eat'],
  ['Have a rewind button for your mistakes in games', 'Have an aimbot-free perfect aim'],
  ['Explore space', 'Explore the deep ocean'],
  ['Be famous for a great play', 'Be famous for a hilarious fail'],
  ['Always play on a controller', 'Always play on keyboard and mouse'],
  ['Have a teammate who talks nonstop', 'Have a teammate who never talks'],
  ['Time travel to the past', 'Time travel to the future'],
  ['Win the lottery', 'Get a job you love'],
];

export const HANGMAN_WORDS = [
  'ZOMBIE', 'CREEPER', 'CONTROLLER', 'KEYBOARD', 'HEADSHOT', 'RESPAWN', 'DUNGEON', 'DRAGON', 'WIZARD', 'ARCHER',
  'SWORD', 'SHIELD', 'QUEST', 'ARMOR', 'CASTLE', 'TREASURE', 'PIRATE', 'NINJA', 'ROBOT', 'GALAXY',
  'ROCKET', 'JUNGLE', 'VOLCANO', 'THUNDER', 'PHANTOM', 'GLITCH', 'LEADERBOARD', 'ACHIEVEMENT', 'SNIPER', 'CHAMPION',
  'MONSTER', 'ADVENTURE', 'MULTIPLAYER', 'STREAMER', 'HEADSET', 'MONITOR', 'GRAPHICS', 'POTION', 'BATTLEFIELD', 'EXPLORER',
];
