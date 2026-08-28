/** Owns selectable relic metadata and equipment-level timing modifiers. */
function sortNames(names: Iterable<string>): string[] {
  return [...names].sort((a, b) => a.localeCompare(b));
}

// ─── Relic Data ───────────────────────────────────────────────────────────────
// Runtime owns behavior; trigger text summarizes both activation and payoff for equipment UI.
export const RELIC_DATA = {
  Akeem: {
    trigger: 'CC a foe with 5+ Torment or Confusion (2 Confusion for 10s, 2 Torment for 10s)',
    cooldown: 10,
    icon: 'https://render.guildwars2.com/file/594C437E9606A167F4F372BCEB0C2B7C7828037B/3122330.png'
  },
  Blightbringer: {
    trigger: 'Apply Poison with six distinct skill activations (3 Poison for 10s)',
    cooldown: 8,
    icon: 'https://render.guildwars2.com/file/286C60AC6FA239B0070293039091A44476A35E90/3375219.png'
  },
  Bloodstone: {
    trigger: 'Complete four blast combos (3.0 strike, 6 bleeding, +7% strike damage)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/A7327A7EDB4705EA05261110526D72AFEAF7DAB4/3629397.png'
  },
  Fireworks: {
    trigger: 'Use a weapon skill with recharge ≥20s (+7% strike damage for 7s)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/2999CCF7C94267B2EE3DDA7459050864622927C9/3122349.png'
  },
  Mistburn: {
    trigger: 'Grant yourself Might; +10% critical chance at 10+ Might',
    cooldown: 1
  },
  'Mist Stranger': { trigger: 'Extra flat damage on every hit', cooldown: 0 },
  Nourys: {
    trigger: 'Gain 1 stack every 3s in combat (10 stacks → 5s damage buff)',
    cooldown: 0,
    icon: 'https://wiki.guildwars2.com/images/3/3f/Relic_of_Nourys.png'
  },
  Peitha: {
    trigger: 'Use shadowstep or deception skill (+10% strike damage for 4s, 2 Torment for 7s)',
    cooldown: 4,
    icon: 'https://render.guildwars2.com/file/949A6A4179F514FCDEF3AC3D9C292B38D5E0047D/3122365.png'
  },
  Shackles: {
    trigger: 'Immobilize an enemy (5s tether, 3.0 strike on expiry)',
    cooldown: 10,
    icon: 'https://render.guildwars2.com/file/7946A50DBDC2E45E004AAA801904015C50CC22B3/3745069.png'
  },
  Steamshrieker: {
    trigger: 'Combo a water field with a leap or blast finisher (1 Burning for 5s)',
    cooldown: 0,
    // Keep relic-owned result rows on the relic artwork instead of falling back to the triggering skill icon.
    icon: 'https://render.guildwars2.com/file/23B0F0A5BF05E05C9F527BF7EB4962C9F49C6F42/3441975.png'
  },
  Aristocracy: {
    trigger: 'Inflict Weakness or Vulnerability (+3% condition duration per stack for 8s, up to 5 stacks)',
    cooldown: 1,
    icon: 'https://render.guildwars2.com/file/BCC01F0B6616FE26ED4BE159532A6A6FBD0EA2D8/3122332.png'
  },
  Brawler: {
    trigger: 'Grant yourself Protection or Resolution (+10% strike damage for 4s)',
    cooldown: 8,
    icon: 'https://render.guildwars2.com/file/2B5297A932F55DA3BDDD0A39C9CB0D9CF70244A1/3122334.png'
  },
  Claw: {
    trigger: 'CC enemy (+7% strike damage for 8s)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png'
  },
  Dragonhunter: {
    trigger: 'Hit a foe with a trap skill (+10% strike damage and condition duration for 5s)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/F61EEC535059F1FA027049AB4DEFCD5465405DB7/3122344.png'
  },
  Deadeye: {
    trigger: 'Use a cantrip skill (+10% strike damage for 8s)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/A36DB29059090F04E4565724E3673CFD189E6177/1770000.png'
  },
  Eagle: {
    trigger: '+10% strike damage against foes below 50% health',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/DFF4EB43AD0803F60D105658052321A0BE1AF02C/3592832.png'
  },
  Fractal: {
    trigger: 'Apply Bleeding to a foe with 6+ Bleeding (2 Burning for 8s, 3 Torment for 8s)',
    cooldown: 20,
    icon: 'https://render.guildwars2.com/file/B2D409644147BF18935A95A52505ABCB9EECE142/3122351.png'
  },
  Thorns: {
    trigger: 'Hit by a poisoned foe (+30 Condition Damage)',
    cooldown: 5,
    icon: 'https://wiki.guildwars2.com/images/8/8a/Relic_of_Thorns.png'
  },
  Thief: {
    trigger: 'Use a weapon skill with recharge or resource cost (+1% strike damage for 6s, up to 5 stacks)',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/3523AC08EB04347CF371E9A91F4B985D12FB4ED3/3122371.png'
  },
  Warrior: {
    trigger: 'Reduce weapon swap recharge by 25%',
    cooldown: 0,
    weaponSwapRechargeMultiplier: 0.75
  }
};

/** Resolves an equipped relic's shared weapon-swap timing modifier. */
export function relicWeaponSwapRechargeMultiplier(relicName: string | undefined): number {
  const relic = RELIC_DATA[relicName as keyof typeof RELIC_DATA];
  return relic && 'weaponSwapRechargeMultiplier' in relic ? Number(relic.weaponSwapRechargeMultiplier) : 1;
}

export const RELIC_NAMES = sortNames(Object.keys(RELIC_DATA));

export const RELIC_GROUPS = [
  {
    label: 'Power',
    items: [
      'Brawler',
      'Bloodstone',
      'Claw',
      'Deadeye',
      'Dragonhunter',
      'Eagle',
      'Fireworks',
      'Mist Stranger',
      'Mistburn',
      'Shackles',
      'Thief'
    ]
  },
  {
    label: 'Condition',
    items: ['Akeem', 'Aristocracy', 'Blightbringer', 'Fractal', 'Steamshrieker', 'Thorns']
  },
  {
    label: 'Hybrid',
    items: ['Nourys', 'Peitha', 'Warrior']
  }
];
