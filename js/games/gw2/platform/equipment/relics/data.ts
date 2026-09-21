/** Owns the static relic table: selectable metadata and equipment-level timing values. */

// Runtime owns behavior; trigger text summarizes both activation and payoff for equipment UI.
// Item icons from the GW2 API supply shared artwork for equipment controls and result rows.
export const RELIC_DATA = {
  // Both slot-skill relics can carry their remaining buff duration through a Combat Start marker.
  Director: {
    category: 'Power',
    trigger: 'Use a healing skill (8 Vulnerability for 8s; +10% strike damage to vulnerable foes for 6s)',
    cooldown: 15,
    icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Relic_of_the_Director.png'
  },
  'Mount Balrior': {
    category: 'Power',
    trigger: 'Use an elite skill (+15% strike damage for 6s after a 1s delay; assumes standing in the area)',
    cooldown: 30,
    icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Relic_of_Mount_Balrior.png'
  },
  Akeem: {
    category: 'Condition',
    trigger: 'CC a foe with 5+ Torment or Confusion (2 Confusion for 10s, 2 Torment for 10s)',
    cooldown: 10,
    icon: 'https://render.guildwars2.com/file/594C437E9606A167F4F372BCEB0C2B7C7828037B/3122330.png'
  },
  Blightbringer: {
    category: 'Condition',
    trigger: 'Apply Poison with six distinct skill activations (3 Poison for 10s)',
    cooldown: 8,
    icon: 'https://render.guildwars2.com/file/286C60AC6FA239B0070293039091A44476A35E90/3375219.png'
  },
  Bloodstone: {
    category: 'Power',
    trigger: 'Complete four blast combos (3.0 strike, 6 bleeding, +7% strike damage)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/A7327A7EDB4705EA05261110526D72AFEAF7DAB4/3629397.png'
  },
  Fireworks: {
    category: 'Power',
    trigger: 'Deal strike damage with a skill with recharge ≥20s (+7% strike damage for 6s)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/2999CCF7C94267B2EE3DDA7459050864622927C9/3122349.png'
  },
  Mistburn: {
    category: 'Power',
    trigger: 'Grant yourself Might; +10% critical chance at 10+ Might',
    cooldown: 1,
    // Supply the relic artwork for optimizer results and equipment previews.
    icon: 'https://render.guildwars2.com/file/FFCB62CF19806066D21C0EA1BA43986C0DA2B6F3/3629399.png'
  },
  Mirage: {
    category: 'Condition',
    trigger: 'Successfully evade an attack (2 Torment for 6s)',
    cooldown: 1,
    icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Relic_of_the_Mirage.png'
  },
  'Mist Stranger': {
    category: 'Power',
    trigger: 'Extra flat damage on every hit',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/2DA75566B948AADFAB0CCF2198F205AF9AE82031/3709381.png'
  },
  Nourys: {
    category: 'Hybrid',
    trigger: 'Gain 1 stack every 3s in combat (10 stacks → 5s damage buff)',
    cooldown: 0,
    icon: 'https://wiki.guildwars2.com/images/3/3f/Relic_of_Nourys.png'
  },
  Peitha: {
    category: 'Hybrid',
    trigger: 'Use shadowstep or deception skill (+10% strike damage for 4s, 2 Torment for 7s)',
    cooldown: 4,
    icon: 'https://render.guildwars2.com/file/949A6A4179F514FCDEF3AC3D9C292B38D5E0047D/3122365.png'
  },
  Shackles: {
    category: 'Power',
    trigger: 'Immobilize an enemy (5s tether, 3.0 strike on expiry)',
    cooldown: 10,
    icon: 'https://render.guildwars2.com/file/7946A50DBDC2E45E004AAA801904015C50CC22B3/3745069.png'
  },
  Steamshrieker: {
    category: 'Condition',
    trigger: 'Combo a water field with a leap or blast finisher (1 Burning for 5s)',
    cooldown: 0,
    // Keep relic-owned result rows on the relic artwork instead of falling back to the triggering skill icon.
    icon: 'https://render.guildwars2.com/file/23B0F0A5BF05E05C9F527BF7EB4962C9F49C6F42/3441975.png'
  },
  Aristocracy: {
    category: 'Condition',
    trigger: 'Inflict Weakness or Vulnerability (+3% condition duration per stack for 8s, up to 5 stacks)',
    cooldown: 1,
    icon: 'https://render.guildwars2.com/file/BCC01F0B6616FE26ED4BE159532A6A6FBD0EA2D8/3122332.png'
  },
  Brawler: {
    category: 'Power',
    trigger: 'Grant yourself Protection or Resolution (+10% strike damage for 4s)',
    cooldown: 8,
    icon: 'https://render.guildwars2.com/file/2B5297A932F55DA3BDDD0A39C9CB0D9CF70244A1/3122334.png'
  },
  Claw: {
    category: 'Power',
    trigger: 'CC enemy (+7% strike damage for 8s)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png'
  },
  Dragonhunter: {
    category: 'Power',
    trigger: 'Hit a foe with a trap skill (+10% strike damage and condition duration for 5s)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/F61EEC535059F1FA027049AB4DEFCD5465405DB7/3122344.png'
  },
  Deadeye: {
    category: 'Power',
    trigger: 'Use a cantrip skill (+10% strike damage for 8s)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/060151B961CE56CB9546E7B6AF33B0A318426372/3122342.png'
  },
  Eagle: {
    category: 'Power',
    trigger: '+10% strike damage against foes below 50% health',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/DFF4EB43AD0803F60D105658052321A0BE1AF02C/3592832.png'
  },
  Fractal: {
    category: 'Condition',
    trigger: 'Apply Bleeding to a foe with 6+ Bleeding (2 Burning for 8s, 3 Torment for 8s)',
    cooldown: 20,
    icon: 'https://render.guildwars2.com/file/B2D409644147BF18935A95A52505ABCB9EECE142/3122351.png'
  },
  'Last Tyrant': {
    category: 'Condition',
    trigger: "Inflict Burning at 5 Tyrant's Fury stacks (explosion: 3.0 strike placeholder, 2 Burning for 8s)",
    cooldown: 12,
    icon: 'https://render.guildwars2.com/file/DC0E5B235AA36102E0A9A9D32AAB24169B2CAE59/3806032.png'
  },
  Visionary: {
    category: 'Hybrid',
    trigger: 'Finish 8 combos (+10% strike and condition damage for 8s; whirls count once per 3s)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/042320E3287590E14067362A6DFD07191DB52C23/3806034.png'
  },
  Thorns: {
    category: 'Condition',
    trigger: 'Hit by a poisoned foe (+30 Condition Damage)',
    cooldown: 5,
    icon: 'https://wiki.guildwars2.com/images/8/8a/Relic_of_Thorns.png'
  },
  Thief: {
    category: 'Power',
    trigger: 'Use a weapon skill with recharge or resource cost (+1% strike damage for 6s, up to 5 stacks)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/3523AC08EB04347CF371E9A91F4B985D12FB4ED3/3122371.png'
  },
  Warrior: {
    category: 'Hybrid',
    trigger: 'Reduce weapon swap recharge by 2.5 seconds',
    cooldown: 0,
    weaponSwapRechargeReduction: 2.5,
    icon: 'https://render.guildwars2.com/file/1D3CF82C05450A605921F6EB9D0AC23421C9CFA5/3122375.png'
  }
} satisfies Record<
  string,
  {
    category: 'Power' | 'Condition' | 'Hybrid';
    trigger: string;
    cooldown: number;
    icon: string;
    weaponSwapRechargeReduction?: number;
  }
>;
