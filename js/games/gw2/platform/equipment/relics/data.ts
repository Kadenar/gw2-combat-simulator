/** Canonical exotic item IDs verified against the public GW2 items API. */
export const RELIC_IDS = Object.freeze({
  DIRECTOR: 109351,
  MOUNT_BALRIOR: 103872,
  AGONY: 104849,
  AKEEM: 100432,
  BLIGHTBRINGER: 102199,
  BLOODSTONE: 104800,
  FIREWORKS: 100262,
  HERALD: 100219,
  MISTBURN: 104994,
  MIDNIGHT_KING: 101139,
  MIRAGE: 100158,
  MIST_STRANGER: 106206,
  NOURYS: 101191,
  PEITHA: 100177,
  SHACKLES: 106916,
  STEAMSHRIEKER: 104022,
  ARISTOCRACY: 100849,
  BRAWLER: 100527,
  CLAW: 103574,
  DRAGONHUNTER: 100090,
  DEADEYE: 100924,
  EAGLE: 104241,
  FRACTAL: 100153,
  LAST_TYRANT: 109942,
  TYRIAN_HERO: 109998,
  VISIONARY: 110152,
  THORNS: 104424,
  THIEF: 100916,
  WARRIOR: 100144
});

/** Owns the static relic table: selectable metadata and equipment-level timing values. */

// Runtime owns behavior; trigger text summarizes both activation and payoff for equipment UI.
// Item icons from the GW2 API supply shared artwork for equipment controls and result rows.
export const RELIC_DATA = {
  // Both slot-skill relics can carry their remaining buff duration through a Combat Start marker.
  Director: {
    id: RELIC_IDS.DIRECTOR,
    category: 'Power',
    trigger:
      'Using a healing skill applies 8 stacks of Vulnerability for 8s. For 6s, deal 10% more strike damage to vulnerable foes.',
    cooldown: 15,
    icon: new URL('@images/wiki/relic-of-the-director.png', import.meta.url).href
  },
  'Mount Balrior': {
    id: RELIC_IDS.MOUNT_BALRIOR,
    category: 'Power',
    trigger:
      'Using an elite skill grants 15% more strike damage for 6s after a 1s delay. Assumes you stand in the area.',
    cooldown: 30,
    icon: new URL('@images/wiki/relic-of-mount-balrior.png', import.meta.url).href
  },
  Agony: {
    id: RELIC_IDS.AGONY,
    category: 'Condition',
    trigger:
      'Interrupting a foe applies Agony of the Choir for 5s. Each second deals 134.5 damage plus 15.5% of your Condition Damage.',
    cooldown: 3,
    icon: new URL('@images/wiki/relic-of-agony.png', import.meta.url).href
  },
  Akeem: {
    id: RELIC_IDS.AKEEM,
    category: 'Condition',
    trigger:
      'Disabling a foe with at least 5 stacks of Torment or Confusion applies 2 stacks each of Confusion and Torment for 10s.',
    cooldown: 10,
    icon: 'https://render.guildwars2.com/file/594C437E9606A167F4F372BCEB0C2B7C7828037B/3122330.png'
  },
  Blightbringer: {
    id: RELIC_IDS.BLIGHTBRINGER,
    category: 'Condition',
    trigger: 'Applying Poison through six separate skill activations applies 3 extra stacks of Poison for 10s.',
    cooldown: 8,
    icon: 'https://render.guildwars2.com/file/286C60AC6FA239B0070293039091A44476A35E90/3375219.png'
  },
  Bloodstone: {
    id: RELIC_IDS.BLOODSTONE,
    category: 'Power',
    trigger:
      'Completing four blast combos triggers a strike with a 3.0 damage coefficient, applies 6 stacks of Bleeding, and grants 7% more strike damage.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/A7327A7EDB4705EA05261110526D72AFEAF7DAB4/3629397.png'
  },
  Fireworks: {
    id: RELIC_IDS.FIREWORKS,
    category: 'Power',
    trigger: 'Dealing strike damage with a skill whose recharge is at least 20s grants 7% more strike damage for 6s.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/2999CCF7C94267B2EE3DDA7459050864622927C9/3122349.png'
  },
  // Boon grants build a shared concentration pool for both damage archetypes.
  Herald: {
    id: RELIC_IDS.HERALD,
    category: 'Hybrid',
    trigger:
      'Granting a boon to yourself or allies grants 25 Concentration for 3s, up to 10 stacks. Each trigger refreshes all stacks.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/DE62250A48F802DD09A1FAFF0D2BA804EA29A3B9/3122352.png'
  },
  Mistburn: {
    id: RELIC_IDS.MISTBURN,
    category: 'Power',
    trigger:
      'Granting yourself Might adds 1 extra stack for 8s. Gain 10% critical chance while you have at least 10 stacks of Might.',
    cooldown: 1,
    // Supply the relic artwork for optimizer results and equipment previews.
    icon: 'https://render.guildwars2.com/file/FFCB62CF19806066D21C0EA1BA43986C0DA2B6F3/3629399.png'
  },
  // Disable-triggered party boons support both strike and condition builds.
  'Midnight King': {
    id: RELIC_IDS.MIDNIGHT_KING,
    category: 'Hybrid',
    trigger: 'Disabling an enemy grants you and nearby allies 3 stacks of Might for 9s and Fury for 5s.',
    cooldown: 1,
    icon: 'https://render.guildwars2.com/file/C0602C3D27B10AC815D4B9F0DF0E4C3D23D12E9F/3187630.png'
  },
  Mirage: {
    id: RELIC_IDS.MIRAGE,
    category: 'Condition',
    trigger: 'Evading an attack applies 2 stacks of Torment for 6s.',
    cooldown: 1,
    icon: new URL('@images/wiki/relic-of-the-mirage.png', import.meta.url).href
  },
  'Mist Stranger': {
    id: RELIC_IDS.MIST_STRANGER,
    category: 'Power',
    trigger: 'Add a fixed amount of damage to every hit.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/2DA75566B948AADFAB0CCF2198F205AF9AE82031/3709381.png'
  },
  Nourys: {
    id: RELIC_IDS.NOURYS,
    category: 'Hybrid',
    trigger: 'Gain 1 stack every 3s in combat. Reaching 10 stacks grants a damage bonus for 5s.',
    cooldown: 0,
    icon: new URL('@images/wiki/relic-of-nourys.png', import.meta.url).href
  },
  Peitha: {
    id: RELIC_IDS.PEITHA,
    category: 'Hybrid',
    trigger:
      'Using a shadowstep or deception skill grants 10% more strike damage for 4s and applies 2 stacks of Torment for 7s.',
    cooldown: 4,
    icon: 'https://render.guildwars2.com/file/949A6A4179F514FCDEF3AC3D9C292B38D5E0047D/3122365.png'
  },
  Shackles: {
    id: RELIC_IDS.SHACKLES,
    category: 'Power',
    trigger: 'Immobilizing an enemy tethers it for 5s. When the tether expires, strike with a 3.0 damage coefficient.',
    cooldown: 10,
    icon: 'https://render.guildwars2.com/file/7946A50DBDC2E45E004AAA801904015C50CC22B3/3745069.png'
  },
  Steamshrieker: {
    id: RELIC_IDS.STEAMSHRIEKER,
    category: 'Condition',
    trigger: 'Completing a leap or blast finisher in a water field applies 1 stack of Burning for 5s.',
    cooldown: 0,
    // Keep relic-owned result rows on the relic artwork instead of falling back to the triggering skill icon.
    icon: 'https://render.guildwars2.com/file/23B0F0A5BF05E05C9F527BF7EB4962C9F49C6F42/3441975.png'
  },
  Aristocracy: {
    id: RELIC_IDS.ARISTOCRACY,
    category: 'Condition',
    trigger: 'Inflicting Weakness or Vulnerability grants 3% condition duration for 8s, up to 5 stacks.',
    cooldown: 1,
    icon: 'https://render.guildwars2.com/file/BCC01F0B6616FE26ED4BE159532A6A6FBD0EA2D8/3122332.png'
  },
  Brawler: {
    id: RELIC_IDS.BRAWLER,
    category: 'Power',
    trigger: 'Granting yourself Protection or Resolution grants 10% more strike damage for 4s.',
    cooldown: 8,
    icon: 'https://render.guildwars2.com/file/2B5297A932F55DA3BDDD0A39C9CB0D9CF70244A1/3122334.png'
  },
  Claw: {
    id: RELIC_IDS.CLAW,
    category: 'Power',
    trigger: 'Disabling an enemy grants 7% more strike damage for 8s.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png'
  },
  Dragonhunter: {
    id: RELIC_IDS.DRAGONHUNTER,
    category: 'Power',
    trigger: 'Hitting a foe with a trap skill grants 10% more strike damage and condition duration for 5s.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/F61EEC535059F1FA027049AB4DEFCD5465405DB7/3122344.png'
  },
  Deadeye: {
    id: RELIC_IDS.DEADEYE,
    category: 'Power',
    trigger: 'Using a cantrip skill grants 10% more strike damage for 8s.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/060151B961CE56CB9546E7B6AF33B0A318426372/3122342.png'
  },
  Eagle: {
    id: RELIC_IDS.EAGLE,
    category: 'Power',
    trigger: 'Deal 10% more strike damage to foes below 50% health.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/DFF4EB43AD0803F60D105658052321A0BE1AF02C/3592832.png'
  },
  Fractal: {
    id: RELIC_IDS.FRACTAL,
    category: 'Condition',
    trigger:
      'Applying Bleeding to a foe with at least 6 stacks of Bleeding also applies 2 stacks of Burning and 3 stacks of Torment for 8s.',
    cooldown: 20,
    icon: 'https://render.guildwars2.com/file/B2D409644147BF18935A95A52505ABCB9EECE142/3122351.png'
  },
  'Last Tyrant': {
    id: RELIC_IDS.LAST_TYRANT,
    category: 'Condition',
    trigger:
      "Inflicting Burning at 5 Tyrant's Fury stacks triggers an explosion and applies 2 stacks of Burning for 8s. The explosion uses a placeholder damage coefficient of 3.0.",
    cooldown: 12,
    icon: 'https://render.guildwars2.com/file/DC0E5B235AA36102E0A9A9D32AAB24169B2CAE59/3806032.png'
  },
  // Shouts and commands supply party boons while Superspeed belongs only to the wearer.
  'Tyrian Hero': {
    id: RELIC_IDS.TYRIAN_HERO,
    category: 'Hybrid',
    trigger:
      'Using a shout or command grants you Superspeed for 3s. You and nearby allies also gain 2 stacks of Might and Swiftness for 10s.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/7C1CE5C27D0AB8216D48E3D5DF30EE9780B7B398/3806033.png'
  },
  Visionary: {
    id: RELIC_IDS.VISIONARY,
    category: 'Hybrid',
    trigger:
      'Completing 8 combos grants 10% more strike and condition damage for 8s. Whirl finishers count once every 3s.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/042320E3287590E14067362A6DFD07191DB52C23/3806034.png'
  },
  Thorns: {
    id: RELIC_IDS.THORNS,
    category: 'Condition',
    trigger: 'Being hit by a poisoned foe grants 30 Condition Damage.',
    cooldown: 5,
    icon: new URL('@images/wiki/relic-of-thorns.png', import.meta.url).href
  },
  Thief: {
    id: RELIC_IDS.THIEF,
    category: 'Power',
    trigger:
      'Using a weapon skill with a recharge or resource cost grants 1% more strike damage for 6s, up to 5 stacks.',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/3523AC08EB04347CF371E9A91F4B985D12FB4ED3/3122371.png'
  },
  Warrior: {
    id: RELIC_IDS.WARRIOR,
    category: 'Hybrid',
    trigger: 'Reduce weapon swap recharge by 2.5 seconds.',
    cooldown: 0,
    weaponSwapRechargeReduction: 2.5,
    icon: 'https://render.guildwars2.com/file/1D3CF82C05450A605921F6EB9D0AC23421C9CFA5/3122375.png'
  }
} satisfies Record<
  string,
  {
    id: number;
    category: 'Power' | 'Condition' | 'Hybrid';
    trigger: string;
    cooldown: number;
    icon: string;
    weaponSwapRechargeReduction?: number;
  }
>;

/** Runtime rules use item IDs; names remain the public build and display vocabulary. */
export const RELIC_BY_ID: Readonly<
  Record<number, (typeof RELIC_DATA)[keyof typeof RELIC_DATA] & { readonly name: string }>
> = Object.freeze(Object.fromEntries(Object.entries(RELIC_DATA).map(([name, data]) => [data.id, { ...data, name }])));
