/** Renegade skill and proc profiles owned by the Renegade module. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { BalanceProfile, Skill, SkillFragment, SkillId } from '#gw2/platform/engine/types.js';

export const RENEGADE_PROFILE_IDS = Object.freeze({
  spiritBoon: 'revenant.renegade.spirit-boon-renegade',
  bandTogether: 'revenant.renegade.band-together',
  kallasFervor: 'revenant.renegade.kallas-fervor',
  kallasFervorLastingLegacy: 'revenant.renegade.kallas-fervor-lasting-legacy',
  heroicCommandLastingLegacy: 'revenant.renegade.heroic-command-lasting-legacy',
  ordersFromAboveRighteousRebel: 'revenant.renegade.orders-from-above-righteous-rebel',
  razorclawsRageProc: 'revenant.renegade.razorclaws-rage-proc',
  soulcleavesSummitProc: 'revenant.renegade.soulcleaves-summit-proc',
  endlessEnmity: 'revenant.renegade.endless-enmity',
  bloodFury: 'revenant.renegade.blood-fury',
  allForOne: 'revenant.renegade.all-for-one',
  vindication: 'revenant.renegade.vindication'
});

export const RENEGADE_SPIRIT_BOON_PROFILE_ID = RENEGADE_PROFILE_IDS.spiritBoon;

export const RENEGADE_ENHANCED_SKILL_BY_ID: Readonly<Record<number, SkillId>> = Object.freeze({
  [ID.ICERAZORS_IRE]: ID.ICERAZORS_IRE_ID_72359,
  [ID.RAZORCLAWS_RAGE]: ID.RAZORCLAWS_RAGE_ID_72363,
  [ID.DARKRAZORS_DARING]: ID.DARKRAZORS_DARING_ID_72366,
  [ID.BREAKRAZORS_BASTION]: ID.BREAKRAZORS_BASTION_ID_72389
});

const BASE_RAZORCLAW_EFFECTS = Object.freeze([
  {
    type: 'strike',
    coefficient: 2,
    hits: 1,
    name: "Razorclaw's Rage",
    actorType: 'player'
  },
  {
    type: 'condition',
    condition: 'Bleeding',
    stacks: 4,
    duration: 8,
    actorType: 'player'
  },
  {
    type: 'buff',
    kind: 'razorclaws-rage',
    duration: 5,
    stacks: 4,
    actorType: 'player',
    recipients: 'party'
  }
] as const);

const BASE_BREAKRAZOR_EFFECTS = Object.freeze([
  {
    type: 'boon',
    boon: 'resolution',
    duration: 2.5,
    stacks: 1
  },
  {
    type: 'boon',
    boon: 'resolution',
    duration: 4,
    stacks: 1
  }
] as const);

export const RENEGADE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ICERAZORS_IRE]: {
    implemented: true,
    handlerId: 'revenant.band-together',
    castTimeMs: 520,
    unaffectedByQuickness: true,
    cooldown: 10,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        name: "Icerazor's Ire",
        actorType: 'player',
        ticks: [
          { atMs: 500, coefficient: 2 },
          { atMs: 661, coefficient: 2 },
          { atMs: 822, coefficient: 2 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [
          {
            atMs: 500,
            condition: 'Vulnerability',
            stacks: 10,
            duration: 8
          },
          { atMs: 500, condition: 'Torment', stacks: 3, duration: 6 },
          {
            atMs: 500,
            condition: 'Vulnerability',
            stacks: 5,
            duration: 8
          },
          {
            atMs: 822,
            condition: 'Immobilized',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryRenegade'
  },
  [ID.DARKRAZORS_DARING]: {
    implemented: true,
    handlerId: 'revenant.band-together',
    castTimeMs: 500,
    unaffectedByQuickness: true,
    cooldown: 12,
    energyCost: 25,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 3 }],
        name: "Darkrazor's Daring",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 1,
        stacks: 1,
        recipients: 'self'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 3,
        recipients: 'allies',
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        duration: 2,
        actorType: 'player',
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'daze',
          breakbar: 200
        }
      }
    ],
    legendId: 'LegendaryRenegade'
  },
  [ID.DISMISS_LIEUTENANT_SOULCLEAVE]: {
    implemented: true,
    handlerId: 'revenant.upkeep-release',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    flipParentId: ID.SOULCLEAVES_SUMMIT,
    legendId: 'LegendaryRenegade'
  },
  [ID.CITADEL_BOMBARDMENT]: {
    implemented: true,
    castTimeMs: 600,
    unaffectedByQuickness: true,
    cooldown: 15,
    energyCost: 35,
    effects: [
      {
        type: 'strike',
        name: 'Citadel Bombardment',
        actorType: 'player',
        ticks: [
          { atMs: 245, coefficient: 0.6 },
          { atMs: 359, coefficient: 0.6 },
          { atMs: 473, coefficient: 0.6 },
          { atMs: 559, coefficient: 0.6 },
          { atMs: 645, coefficient: 0.6 },
          { atMs: 760, coefficient: 0.6 },
          { atMs: 847, coefficient: 0.6 },
          { atMs: 959, coefficient: 0.6 },
          { atMs: 1075, coefficient: 0.6 },
          { atMs: 1196, coefficient: 0.6 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [
          { atMs: 245, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 359, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 473, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 559, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 645, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 760, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 847, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 959, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 1075, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 1196, condition: 'Burning', stacks: 1, duration: 1 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RAZORCLAWS_RAGE]: {
    implemented: true,
    handlerId: 'revenant.band-together',
    castTimeMs: 500,
    cooldown: 15,
    energyCost: 25,
    effects: BASE_RAZORCLAW_EFFECTS,
    legendId: 'LegendaryRenegade'
  },
  [ID.HEROIC_COMMAND]: {
    implemented: true,
    handlerId: 'revenant.heroic-command',
    castTimeMs: 500,
    cooldown: 10,
    energyCost: 10,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.ORDERS_FROM_ABOVE]: {
    implemented: true,
    handlerId: 'revenant.orders-from-above',
    castTimeMs: 0,
    cooldown: 20,
    energyCost: 20,
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 2,
        stacks: 1,
        applications: 4,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.BREAKRAZORS_BASTION]: {
    implemented: true,
    handlerId: 'revenant.band-together',
    castTimeMs: 750,
    cooldown: 30,
    energyCost: 5,
    effects: BASE_BREAKRAZOR_EFFECTS,
    legendId: 'LegendaryRenegade'
  },
  [ID.SOULCLEAVES_SUMMIT]: {
    implemented: true,
    handlerId: 'revenant.upkeep',
    castTimeMs: 500,
    cooldown: 3,
    energyCost: 5,
    upkeepCost: 5,
    pulseInterval: 1,
    manualReleaseCooldown: 3,
    flipSkillId: ID.DISMISS_LIEUTENANT_SOULCLEAVE,
    effects: [],
    legendId: 'LegendaryRenegade'
  },
  [ID.ICERAZORS_IRE_ID_72359]: {
    implemented: true,
    simulatorExcluded: true,
    slotSelectable: false,
    variantBadge: 'Band Together',
    castTimeMs: 0,
    cooldown: 10,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        name: "Icerazor's Ire",
        actorType: 'player',
        ticks: [
          { atMs: 1200, coefficient: 2 },
          { atMs: 1361, coefficient: 2 },
          { atMs: 1522, coefficient: 2 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [
          {
            atMs: 1200,
            condition: 'Vulnerability',
            stacks: 10,
            duration: 8
          },
          { atMs: 1200, condition: 'Torment', stacks: 3, duration: 6 },
          {
            atMs: 1200,
            condition: 'Vulnerability',
            stacks: 5,
            duration: 8
          },
          { atMs: 1200, condition: 'Chilled', stacks: 1, duration: 1.5 },
          { atMs: 1361, condition: 'Chilled', stacks: 1, duration: 1.5 },
          {
            atMs: 1522,
            condition: 'Immobilized',
            stacks: 1,
            duration: 2
          },
          { atMs: 1522, condition: 'Chilled', stacks: 1, duration: 1.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryRenegade'
  },
  [ID.RAZORCLAWS_RAGE_ID_72363]: {
    implemented: true,
    simulatorExcluded: true,
    slotSelectable: false,
    variantBadge: 'Band Together',
    castTimeMs: 0,
    cooldown: 15,
    energyCost: 25,
    effects: [
      BASE_RAZORCLAW_EFFECTS[0],
      BASE_RAZORCLAW_EFFECTS[1],
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 6,
        actorType: 'player'
      },
      BASE_RAZORCLAW_EFFECTS[2]
    ],
    legendId: 'LegendaryRenegade'
  },
  [ID.DARKRAZORS_DARING_ID_72366]: {
    implemented: true,
    simulatorExcluded: true,
    slotSelectable: false,
    variantBadge: 'Band Together',
    castTimeMs: 0,
    cooldown: 12,
    energyCost: 25,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 3 }],
        name: "Darkrazor's Daring",
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 1,
        stacks: 1,
        recipients: 'self'
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 4,
        stacks: 1,
        recipients: 'allies'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1,
        recipients: 'allies'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 3,
        recipients: 'allies',
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        duration: 2,
        actorType: 'player',
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'daze',
          breakbar: 600,
          bonusDefianceBreak: 400
        }
      }
    ],
    legendId: 'LegendaryRenegade'
  },
  [ID.BREAKRAZORS_BASTION_ID_72389]: {
    implemented: true,
    simulatorExcluded: true,
    slotSelectable: false,
    variantBadge: 'Band Together',
    castTimeMs: 0,
    cooldown: 30,
    energyCost: 5,
    effects: BASE_BREAKRAZOR_EFFECTS,
    legendId: 'LegendaryRenegade'
  },
  [ID.LEGENDARY_RENEGADE_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.CALL_OF_THE_RENEGADE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Call of the Renegade',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      }
    ]
  }
});

function triggeredRenegadeAction(skill: Skill): Skill {
  return {
    type: 'Action',
    slot: 'Action',
    slotSelectable: false,
    specialization: 'Renegade',
    implemented: true,
    simulatorExcluded: true,
    cooldown: 0,
    effects: [],
    ...skill
  };
}

function renegadeBalanceProfile(profile: {
  readonly id: SkillId;
  readonly name: string;
  readonly profileKind?: BalanceProfile['profileKind'];
  readonly effects?: BalanceProfile['effects'];
  readonly [field: string]: unknown;
}): BalanceProfile {
  return {
    profileKind: 'mechanic',
    effects: [],
    ...profile
  };
}

const RENEGADE_DECLARATIONS: readonly (Skill | BalanceProfile)[] = Object.freeze([
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.spiritBoon,
    name: 'Spirit Boon (Renegade)',
    profileKind: 'trait',
    description: 'Invoking Legendary Renegade grants resolution to nearby allies.',
    icon: 'https://render.guildwars2.com/file/62279406A52F47A00CE7BFFB43D405907A67A60F/1012681.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'boon',
        boon: 'resolution',
        duration: 4,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.bandTogether,
    name: 'Band Together',
    description: 'After using a Legendary Renegade skill, the next one is instant and enhanced.',
    effects: [
      {
        type: 'buff',
        kind: 'band-together',
        duration: 4,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.kallasFervor,
    name: "Kalla's Fervor",
    maximumStacks: 5,
    lifeSiphonDamagePerStack: 0.02,
    effects: [
      {
        type: 'buff',
        kind: 'kallas-fervor',
        duration: 8,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.kallasFervorLastingLegacy,
    name: "Kalla's Fervor (Lasting Legacy)",
    profileKind: 'trait',
    variantBadge: 'Lasting Legacy',
    maximumStacks: 5,
    lifeSiphonDamagePerStack: 0.03,
    effects: [
      {
        type: 'buff',
        kind: 'kallas-fervor',
        duration: 12,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.heroicCommandLastingLegacy,
    name: 'Heroic Command (Lasting Legacy)',
    profileKind: 'skill-variant',
    variantBadge: 'Lasting Legacy',
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 3,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.ordersFromAboveRighteousRebel,
    name: 'Orders from Above (Righteous Rebel)',
    profileKind: 'skill-variant',
    variantBadge: 'Righteous Rebel',
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 2,
        stacks: 1,
        applications: 6,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }),
  triggeredRenegadeAction({
    id: RENEGADE_PROFILE_IDS.razorclawsRageProc,
    name: "Razorclaw's Rage — Empowered Attack",
    // Consecutive allied attacks consume the four buff charges without an internal cooldown.
    cooldown: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  }),
  triggeredRenegadeAction({
    id: RENEGADE_PROFILE_IDS.soulcleavesSummitProc,
    name: "Soulcleave's Summit — Triggered Attack",
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: "Soulcleave's Summit — Additional Strike",
        actorType: 'effect'
      },
      {
        type: 'strike',
        coefficient: 0,
        flatStrikeBase: 325,
        flatStrikePowerCoeff: 0.1,
        hits: 1,
        name: "Soulcleave's Summit — Life Siphon",
        actorType: 'effect',
        metadata: {
          noCrit: true
        }
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.endlessEnmity,
    name: 'Endless Enmity',
    profileKind: 'trait',
    icon: 'https://render.guildwars2.com/file/A4D16BE749A19FE8A8B5783EE2BD1DF899156D47/1769999.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 8,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 4,
        stacks: 1,
        recipients: 'party',
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.bloodFury,
    name: 'Blood Fury',
    profileKind: 'trait',
    icon: 'https://render.guildwars2.com/file/10FA58BEA8CF9AAB3F7841B154DC26E95A4FC705/1769989.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 3
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.allForOne,
    name: 'All for One',
    profileKind: 'trait',
    icon: 'https://render.guildwars2.com/file/9398D8F8E764A23596E17EDAA35B99961D62F061/1769993.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    resourceGain: 10,
    rechargeMultiplier: 0.5
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.vindication,
    name: 'Vindication',
    profileKind: 'trait',
    icon: 'https://render.guildwars2.com/file/3453B30240026E36661AACD3FA94FB0DBFC8246C/1769995.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'control',
        duration: 1,
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          breakbar: 100
        }
      }
    ]
  })
]);

function isBalanceProfile(value: Skill | BalanceProfile): value is BalanceProfile {
  return 'profileKind' in value;
}

export const RENEGADE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze(
  RENEGADE_DECLARATIONS.filter(isBalanceProfile)
);

export const RENEGADE_EXTRA_SKILLS: readonly Skill[] = Object.freeze(
  RENEGADE_DECLARATIONS.filter((value): value is Skill => !isBalanceProfile(value))
);
