// data/templates.js

export const durations = [
  { label: '1 Day',  value: 1 },
  { label: '2 Days', value: 2 },
  { label: '3 Days', value: 3 },
  { label: '4 Days', value: 4 },
  { label: '5 Days', value: 5 },
  { label: '6 Days', value: 6 },
  { label: '1 Week', value: 7 },
];

export const categories = [
  {
    name: 'Cryptocurrency',
    templates: [
      {
        id: 'crypto1', name: 'Crypto Chaos', blanks: 5,
        parts: [
          'When Bitcoin soared to ',
          ', the community yelled ',
          '; later it dipped to ',
          ', yet traders still ',
          ', and then ',
          '.'
        ]
      },
      {
        id: 'crypto2', name: 'To the Moon', blanks: 5,
        parts: [
          'Every time ',
          ' tweets about ',
          ', price rockets to ',
          '! Meanwhile ',
          ' investors ',
          '.'
        ]
      },
      {
        id: 'crypto3', name: 'HODL Story', blanks: 5,
        parts: [
          'I bought ',
          ' at ',
          ' and promised to ',
          ' forever if it reached ',
          '.'
        ]
      },
      {
        id: 'crypto4', name: 'NFT Frenzy', blanks: 5,
        parts: [
          'I minted a ',
          ' NFT for ',
          ', then sold at ',
          ' ETH and bought ',
          ', celebrating until ',
          '.'
        ]
      },
      {
        id: 'crypto5', name: 'Meme Coin', blanks: 5,
        parts: [
          'Dogecoin hit ',
          ' cents, I ',
          ' my portfolio, then yelled ',
          ', but still ',
          ', hoping for ',
          '.'
        ]
      },
    ],
  },

  {
    name: 'Funny',
    templates: [
      {
        id: 'funny1', name: 'Office Antics', blanks: 5,
        parts: [
          'During meetings, I always ',
          ' the notes, ',
          ' snacks for my team, ',
          ' coffee, ',
          ' and still ',
          '.'
        ]
      },
      {
        id: 'funny2', name: 'Cat Chronicles', blanks: 5,
        parts: [
          'My cat ',
          ' ate the ',
          ' when I was ',
          ', then ',
          ' and ',
          '.'
        ]
      },
      {
        id: 'funny3', name: 'Lottery Dreams', blanks: 5,
        parts: [
          'If I won the lottery, I would ',
          ' a ',
          ', give ',
          ' to my ',
          ' and ',
          '.'
        ]
      },
      {
        id: 'funny4', name: 'Awkward Zoom', blanks: 5,
        parts: [
          'On Zoom calls I always ',
          ', accidentally unmute and ',
          ', while ',
          ', then ',
          '.'
        ]
      },
      {
        id: 'funny5', name: 'Snack Attack', blanks: 5,
        parts: [
          'I hid ',
          ' in my desk, then stole ',
          ', invited ',
          ', before ',
          ', and finally ',
          '.'
        ]
      },
    ],
  },

  {
    name: 'Pop Culture',
    templates: [
      {
        id: 'pop1', name: 'May the Force', blanks: 5,
        parts: [
          'May the ',
          ' be with ',
          ', always ',
          ', even when ',
          ', because ',
          '.'
        ]
      },
      {
        id: 'pop2', name: 'Movie Tagline', blanks: 5,
        parts: [
          'In a world where ',
          ', one ',
          ' must ',
          ' to save ',
          '.'
        ]
      },
      {
        id: 'pop3', name: 'Music Lyrics', blanks: 5,
        parts: [
          'I got ',
          ' on my ',
          ', feeling ',
          ' like a ',
          ' tonight.'
        ]
      },
      {
        id: 'pop4', name: 'Superhero Intro', blanks: 5,
        parts: [
          'By day I am a ',
          ', but by night I ',
          ' to fight ',
          ', armed with ',
          '.'
        ]
      },
      {
        id: 'pop5', name: 'Reality TV', blanks: 5,
        parts: [
          'On the show ',
          ', drama erupts when ',
          ' confesses ',
          ', leading to ',
          '.'
        ]
      },
    ],
  },

  {
    name: 'Animals',
    templates: [
      {
        id: 'animal1', name: 'Jungle Chase', blanks: 5,
        parts: [
          'The ',
          ' chased the ',
          ' over the ',
          ', through ',
          ', until ',
          '.'
        ]
      },
      {
        id: 'animal2', name: 'Pet Routine', blanks: 5,
        parts: [
          'Every morning, my ',
          ' likes to ',
          ' before ',
          ', then ',
          '.'
        ]
      },
      {
        id: 'animal3', name: 'Wildlife Safari', blanks: 5,
        parts: [
          'On safari I spotted a ',
          ' eating ',
          ', chased by a ',
          ', which then ',
          '.'
        ]
      },
      {
        id: 'animal4', name: 'Farm Fable', blanks: 5,
        parts: [
          'Old MacDonald had a ',
          ', he said ',
          ' and then ',
          ', under the ',
          '.'
        ]
      },
      {
        id: 'animal5', name: 'Ocean Adventure', blanks: 5,
        parts: [
          'I swam with the ',
          ', fed them ',
          ', while a ',
          ' watched and ',
          '.'
        ]
      },
    ],
  },

  {
    name: 'Food',
    templates: [
      {
        id: 'food1', name: 'Cooking Show', blanks: 5,
        parts: [
          'First, chop the ',
          ' and sauté with ',
          '; then add ',
          ' and simmer until ',
          '.'
        ]
      },
      {
        id: 'food2', name: 'Pizza Order', blanks: 5,
        parts: [
          'I always get ',
          ' pizza with extra ',
          ', a side of ',
          ', and a drink of ',
          '.'
        ]
      },
      {
        id: 'food3', name: 'Burger Bliss', blanks: 5,
        parts: [
          'Stack a ',
          ' patty, add ',
          ', top with ',
          ' and ',
          '.'
        ]
      },
      {
        id: 'food4', name: 'Dessert Dreams', blanks: 5,
        parts: [
          'Serve ',
          ' topped with ',
          ', alongside ',
          ', drizzled with ',
          '.'
        ]
      },
      {
        id: 'food5', name: 'Spice Market', blanks: 5,
        parts: [
          'At the bazaar, I bought ',
          ' spice for ',
          ', to flavor ',
          ', and ',
          '.'
        ]
      },
    ],
  },

  {
    name: 'Adventure',
    templates: [
      {
        id: 'adv1', name: 'Space Voyage', blanks: 5,
        parts: [
          'I boarded the ',
          ' bound for ',
          ', equipped with ',
          ' and ',
          '.'
        ]
      },
      {
        id: 'adv2', name: 'Treasure Hunt', blanks: 5,
        parts: [
          'On the map, X marks ',
          '; we sailed to ',
          ', digging for ',
          ' under ',
          '.'
        ]
      },
      {
        id: 'adv3', name: 'Jungle Quest', blanks: 5,
        parts: [
          'Through the ',
          ', we trekked, chasing ',
          ', armed with ',
          ' and ',
          '.'
        ]
      },
      {
        id: 'adv4', name: 'Underwater Dive', blanks: 5,
        parts: [
          'Diving into ',
          ', I saw ',
          ', grabbed ',
          ', then ',
          '.'
        ]
      },
      {
        id: 'adv5', name: 'Mountain Climb', blanks: 5,
        parts: [
          'Climbing ',
          ' with ',
          ' gear, we braved ',
          ' winds, finally ',
          '.'
        ]
      },
    ],
  },

  {
    name: 'Movies',
    templates: [
      {
        id: 'mov1', name: 'Blockbuster', blanks: 5,
        parts: [
          'In a city plagued by ',
          ', one hero ',
          ' must ',
          ' to ',
          '.'
        ]
      },
      {
        id: 'mov2', name: 'Film Noir', blanks: 5,
        parts: [
          'It was a night of ',
          ', I lit a ',
          ', chased a ',
          ', and found ',
          '.'
        ]
      },
      {
        id: 'mov3', name: 'Rom-Com Plot', blanks: 5,
        parts: [
          'She spilled ',
          ' on ',
          ', so ',
          ' chased ',
          ' through ',
          '.'
        ]
      },
      {
        id: 'mov4', name: 'Sci-Fi Saga', blanks: 5,
        parts: [
          'On planet ',
          ', I met ',
          ', we battled ',
          ', and escaped on ',
          '.'
        ]
      },
      {
        id: 'mov5', name: 'Horror Story', blanks: 5,
        parts: [
          'The lights went out in ',
          ', I heard ',
          ', then ',
          ', before ',
          '.'
        ]
      },
    ],
  },

  {
    name: 'Sports',
    templates: [
      {
        id: 'sports1', name: 'Game Winning Shot', blanks: 5,
        parts: [
          'With only ',
          ' seconds left on the clock, ',
          ' dribbled past ',
          ' and nailed a ',
          ' from ',
          '.'
        ]
      },
      {
        id: 'sports2', name: 'Underdog Victory', blanks: 5,
        parts: [
          'Nobody believed ',
          ' could beat ',
          ' in the ',
          ', but they pulled off a ',
          ' that shocked ',
          '.'
        ]
      },
      {
        id: 'sports3', name: 'Olympic Dream', blanks: 5,
        parts: [
          'Since I was ',
          ', I dreamed of ',
          ' in the Olympics, training ',
          ' hours a day and finally qualifying in ',
          '.'
        ]
      },
      {
        id: 'sports4', name: 'Fan Chant', blanks: 5,
        parts: [
          'At every home game, the crowd chants ',
          ', waving ',
          ' and wearing ',
          ' until the final ',
          '.'
        ]
      },
      {
        id: 'sports5', name: 'Stadium Snack', blanks: 5,
        parts: [
          'You haven’t really experienced ',
          ' until you try the ',
          ' with ',
          ' while watching ',
          ' at ',
          '.'
        ]
      },
    ],
  },

  {
    name: 'Technology',
    templates: [
      {
        id: 'tech1',
        name: 'AI Assistant',
        blanks: 5,
        parts: [
          'My AI assistant can now ',
          ' my ',
          ', summarize ',
          ' in ',
          ', and even ',
          '.'
        ]
      },
      {
        id: 'tech2',
        name: 'Startup Pitch',
        blanks: 5,
        parts: [
          'We’re building a platform that ',
          ' the way people ',
          ', using ',
          ' to deliver ',
          ' at scale.'
        ]
      },
      {
        id: 'tech3',
        name: 'Gadget Review',
        blanks: 5,
        parts: [
          'The new ',
          ' boasts a ',
          ', but I found the ',
          ' to be ',
          ', making it ',
          '.'
        ]
      },
      {
        id: 'tech4',
        name: 'Cybersecurity Alert',
        blanks: 4,
        parts: [
          'A recent breach exposed ',
          ' accounts, exploited a ',
          ' in ',
          ', and forced users to ',
          '.'
        ]
      },
      {
        id: 'tech5',
        name: 'Space Tech',
        blanks: 5,
        parts: [
          'By 2030, rockets will be able to ',
          ' payloads of ',
          ' tons to ',
          ', powered by ',
          '.'
        ]
      }
    ]
  },

  {
    name: 'Frog Lore',
    templates: [
      {
        name: 'Toad Prophecy',
        blanks: 3,
        parts: [
          'The sacred toad shall rise on the ',
          ', bearing the ',
          ', and hopping toward the ',
          '.'
        ]
      },
      {
        name: "Toby's Quest",
        blanks: 4,
        parts: [
          'In the marshes of ',
          ', young Toby found a ',
          ', fought a ',
          ', and claimed the ',
          '.'
        ]
      }
    ]
  },

  {
    name: 'Classic Fun',
    templates: [
      {
        name: 'Birthday Bash',
        blanks: 3,
        parts: [
          'I went to a birthday party and ate ',
          ', danced with a ',
          ', and took home a ',
          '.'
        ]
      },
      {
        name: 'Embarrassing Day',
        blanks: 3,
        parts: [
          'It was the most embarrassing moment when I slipped on a ',
          ', landed in a ',
          ', and everyone yelled ',
          '.'
        ]
      }
    ]
  },

  {
    name: 'Holidays',
    templates: [
      {
        name: 'Frosty Chaos',
        blanks: 3,
        parts: [
          'This holiday, I decorated the tree with ',
          ', fed Santa a ',
          ', and found a gift labeled ',
          '.'
        ]
      },
      {
        name: 'New Year Plan',
        blanks: 4,
        parts: [
          'In 2025, I vow to ',
          ', avoid ',
          ', learn ',
          ', and finally conquer ',
          '.'
        ]
      }
    ]
  },

  {
    name: 'Spooky Season',
    templates: [
      {
        name: "Witch's Brew",
        blanks: 3,
        parts: [
          'In the cauldron we stirred ',
          ', mixed in ',
          ', and chanted to summon ',
          '.'
        ]
      },
      {
        name: 'Haunted House',
        blanks: 4,
        parts: [
          'Inside the haunted house I saw a ',
          ', heard a ',
          ', ran from a ',
          ', and screamed ',
          '.'
        ]
      }
    ]
  },

  {
    name: 'Summer',
    templates: [
      {
        name: 'Beach Day',
        blanks: 3,
        parts: [
          'We built a sandcastle with ',
          ', chased crabs with a ',
          ', and ate ice cream shaped like a ',
          '.'
        ]
      },
      {
        name: 'Sunburn Saga',
        blanks: 4,
        parts: [
          'I forgot sunscreen and ended up looking like a ',
          ', hiding under a ',
          ', sipping a ',
          ', and swearing off beaches for ',
          '.'
        ]
      }
    ]
  },

  {
    name: 'Fantasy',
    templates: [
      {
        name: "Dragon's Lair",
        blanks: 4,
        parts: [
          'The knight drew their ',
          ', mounted a ',
          ', battled a ',
          ', and took the treasure to ',
          '.'
        ]
      },
      {
        name: 'Wizard Mishap',
        blanks: 3,
        parts: [
          'The spell backfired, turning my wand into a ',
          ', summoning a ',
          ', and teleporting me to ',
          '.'
        ]
      }
    ]
  },

  {
    name: 'AI & Robots',
    templates: [
      {
        name: 'Bot Apocalypse',
        blanks: 4,
        parts: [
          'The robots rose up with ',
          ', marched through ',
          ', chanting ',
          ', and demanded ',
          '.'
        ]
      },
      {
        name: 'AI Roommate',
        blanks: 3,
        parts: [
          'My AI roommate makes ',
          ', argues about ',
          ', and insists on sleeping in the ',
          '.'
        ]
      }
    ]
  },

  {
    name: 'Shower Thoughts',
    templates: [
      {
        name: 'Deep Realization',
        blanks: 3,
        parts: [
          'While washing my hair, I realized that ',
          ', means ',
          ', which changes everything about ',
          '.'
        ]
      },
      {
        name: 'Toothbrush Paradox',
        blanks: 3,
        parts: [
          'I’ve been using a ',
          ', brushing with ',
          ', and wondering if toothpaste even ',
          '.'
        ]
      }
    ]
  }
]
