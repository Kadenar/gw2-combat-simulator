import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const RANGER_SUPPLEMENTAL_SKILLS: readonly RangerSkill[] = Object.freeze([
  // Supplemental ambush identities retain verified API icons so their catalog entries load directly from the CDN.
  ...[
    {
      icon: 'https://render.guildwars2.com/file/76E435CE09EE9F155FA830BB05211BE0D7AE4DD2/2565746.png',
      id: 63129,
      name: 'Sundering Volley',
      weapon: 'Axe',
      description: 'Throw two axes, bleeding the target and applying vulnerability followed by immobilize.'
    },
    {
      icon: 'https://render.guildwars2.com/file/3B7CC3146E0796B901AA05E4D7AD9AD0DDCC2BC0/3098874.png',
      id: 69223,
      name: 'Neurotoxin Burst',
      weapon: 'Dagger',
      description: 'Shadowstep and strike, applying bleeding, poison, and vulnerability.'
    },
    {
      icon: 'https://render.guildwars2.com/file/AA6DF43F39613B3BFF36EA5E5DE8E479B54C3D13/3256376.png',
      id: 72079,
      name: 'Rampant Growth',
      weapon: 'Mace',
      description: 'Strike with verdant growth and immobilize the target.'
    },
    {
      icon: 'https://render.guildwars2.com/file/47D72665624F25469A11D86943F9037591F444AF/3098875.png',
      id: 69175,
      name: 'Solar Brilliance',
      weapon: 'Staff',
      description: 'Blind nearby enemies, then pulse damage around yourself.'
    },
    {
      icon: 'https://render.guildwars2.com/file/D30E4B593AEE93C795B40F020B3727FCCC5E39D7/2565747.png',
      id: 63350,
      name: 'Savage Slash',
      weapon: 'Greatsword',
      description: 'Strike nearby enemies, applying vulnerability and creating an exploding spore.'
    },
    {
      icon: 'https://render.guildwars2.com/file/AF7A96BB16BD9453059730A6B5EF437E7C72AB3A/2565749.png',
      id: 63225,
      name: 'Multishot',
      weapon: 'Longbow',
      description: 'Fire arrows at your target and nearby enemies.'
    },
    {
      icon: 'https://render.guildwars2.com/file/ED090826AD5C2E700D6604F9E0CC7C1AAEF0C25D/2565750.png',
      id: 63326,
      name: 'Toxic Shot',
      weapon: 'Shortbow',
      description: 'Fire an explosive arrow that poisons and weakens. Already-poisoned targets also receive torment.'
    },
    {
      icon: 'https://render.guildwars2.com/file/100EF926B3F04A73719E7CD531C8ABC81938CF19/3379182.png',
      id: 72932,
      name: "Ravager's Abandon",
      weapon: 'Spear',
      description: 'Strike with a wave of corruption and create an exploding spore.'
    }
  ].map((skill) => ({
    ...skill,
    type: 'Weapon',
    slot: 'Weapon_1',
    specialization: 'Untamed',
    unleashedAmbushSkill: true
  })),
  {
    id: 63438,
    name: 'Relentless Whirl',
    description: 'Spin and attack nearby foes. Create an exploding spore on the first hit.',
    icon: 'https://render.guildwars2.com/file/1FD6BA0D5205082CF724026543A9CE3EA9E3AB10/2565748.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    specialization: 'Untamed',
    unleashedAmbushSkill: true
  },
  {
    id: 63336,
    name: 'Deft Strike',
    description: 'Leap forward and strike the ground, creating an exploding spore.',
    icon: 'https://render.guildwars2.com/file/583FF23D285DAFF432CF2C3BFBE27FF4142D4C9B/2565753.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: 'Untamed',
    unleashedAmbushSkill: true
  },
  {
    id: 63352,
    name: 'Exploding Spore',
    description: 'A delayed spore created by an unleashed ambush.',
    icon: new URL('@images/wiki/exploding-spores.png', import.meta.url).href,
    type: 'Profession',
    specialization: 'Untamed',
    simulatorExcluded: true
  },
  {
    id: 31796,
    name: 'Cosmic Ray',
    description: 'Call down energy onto the targeted area to heal allies.',
    icon: 'https://render.guildwars2.com/file/ADD8B8B5B1EA72760ABB7313EAA8B0DAEC135F5E/1128620.png',
    type: 'Bundle',
    slot: 'Weapon_1',
    specialization: 'Druid',
    celestialAvatarSkill: true
  },
  {
    id: 31406,
    name: 'Seed of Life',
    description: 'Summon a seed that heals and cleanses nearby allies when it blossoms.',
    icon: 'https://render.guildwars2.com/file/761706674AF9092C98D059AB03BD747BFC7DF506/1128623.png',
    type: 'Bundle',
    slot: 'Weapon_2',
    specialization: 'Druid',

    cooldown: 4,
    celestialAvatarSkill: true
  },
  {
    id: 31318,
    name: 'Lunar Impact',
    description: 'Call down a massive lunar beam to heal allies and daze foes.',
    icon: 'https://render.guildwars2.com/file/2708F4B3239D05C7A063FDC37838C9EFF5FCED50/1128625.png',
    type: 'Bundle',
    slot: 'Weapon_3',
    specialization: 'Druid',

    cooldown: 8,
    celestialAvatarSkill: true
  },
  {
    id: 31894,
    name: 'Rejuvenating Tides',
    description: 'Gather tidal force to rapidly heal nearby allies.',
    icon: 'https://render.guildwars2.com/file/0C909F99672AC81E95167114B132F4BF03296E33/1128626.png',
    type: 'Bundle',
    slot: 'Weapon_4',
    specialization: 'Druid',

    cooldown: 8,
    celestialAvatarSkill: true
  },
  {
    id: 31503,
    name: 'Natural Convergence',
    description: 'Channel celestial power, then trap foes in a black hole.',
    icon: 'https://render.guildwars2.com/file/08A7C5E751190ED5596C9112005D791D20AA3B31/1128629.png',
    type: 'Bundle',
    slot: 'Weapon_5',
    specialization: 'Druid',

    cooldown: 10,
    celestialAvatarSkill: true
  },
  {
    id: 77183,
    name: 'Keen Shot',
    description: 'Shoot a wind arrow.',
    icon: 'https://render.guildwars2.com/file/CCBDB172EC3A512C45A9125405AE11993CCCC1A4/3680186.png',
    type: 'Bundle',
    slot: 'Weapon_1',
    specialization: 'Galeshot',
    cycloneBowSkill: true,
    arrowCost: 0
  },
  {
    id: 76664,
    name: 'Hawkeye',
    description: 'Release a hail of arrows toward your target and nearby enemies.',
    icon: 'https://render.guildwars2.com/file/7501721702A2453ED62665041490A4069E6FBBC2/3680191.png',
    type: 'Bundle',
    slot: 'Weapon_1',
    specialization: 'Galeshot',

    cooldown: 1,
    cycloneBowSkill: true,
    arrowCost: 0
  },
  {
    id: 77319,
    name: 'Bluster',
    description: 'Release a rapid volley of arrows.',
    icon: 'https://render.guildwars2.com/file/9A44645021DDF0C10F0D15D0F3900D0FE6E57E69/3680187.png',
    type: 'Bundle',
    slot: 'Weapon_2',
    specialization: 'Galeshot',

    cooldown: 3,
    cycloneBowSkill: true,
    arrowCost: 1
  },
  {
    id: 77012,
    name: 'Fleeting Zephyr',
    description: 'Jump back, releasing a blast of wind.',
    icon: 'https://render.guildwars2.com/file/0E637BE86BAC51085AF40241E9AA9BCFBC2CD3B6/3680188.png',
    type: 'Bundle',
    slot: 'Weapon_3',
    specialization: 'Galeshot',

    cooldown: 8,
    cycloneBowSkill: true,
    arrowCost: 1
  },
  {
    id: 76807,
    name: "Quarry's Peril",
    description: 'Fire a volley that immobilizes enemies when it lands.',
    icon: 'https://render.guildwars2.com/file/59A95C37FEB95E03A4C1F853902F553E801DBAA0/3680189.png',
    type: 'Bundle',
    slot: 'Weapon_4',
    specialization: 'Galeshot',

    cooldown: 12,
    cycloneBowSkill: true,
    arrowCost: 2
  },
  {
    id: 76722,
    name: 'Pelt',
    description: 'Fire a volley of arrows into the air, damaging enemies when they land.',
    icon: 'https://render.guildwars2.com/file/59A95C37FEB95E03A4C1F853902F553E801DBAA0/3680189.png',
    type: 'Bundle',
    slot: 'Weapon_4',
    specialization: 'Galeshot',
    ammo: 2,
    ammoRecharge: 12,
    ammoCastLockout: 1,
    cooldown: 12,
    cycloneBowSkill: true,
    arrowCost: 1
  },
  {
    id: 77174,
    name: 'Supersonic Arrow',
    description: 'Supercharge an arrow with wind magic and launch it at incredible speed.',
    icon: 'https://render.guildwars2.com/file/FAAE665D2923D696F00F4AB5160D23DADAD0047A/3680190.png',
    type: 'Bundle',
    slot: 'Weapon_5',
    specialization: 'Galeshot',

    cooldown: 25,
    cycloneBowSkill: true,
    arrowCost: 3
  },
  {
    id: 76905,
    name: 'Wuthering Wind',
    description: "The active pet's next attack after Bluster creates a damaging swell of wind.",
    icon: 'https://render.guildwars2.com/file/BE5F0405E79D13C89F0D9EF13B1B11479D0C3805/3679993.png',
    type: 'Profession',
    specialization: 'Galeshot',
    simulatorExcluded: true
  }
]);
