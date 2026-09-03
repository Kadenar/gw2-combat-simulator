/**
 * Owns Renegade warband, enhanced Band Together, stance, and triggered skill identities.
 * Patchable mechanic and trait values live in sibling `profiles.ts`.
 */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import { RENEGADE_PROFILE_IDS } from '#gw2/content/professions/revenant/specializations/renegade/profiles.js';
import type { Skill, SkillFragment, SkillId } from '#gw2/platform/engine/types.js';

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
    audience: { recipients: 'party' as const }
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

export const RENEGADE_WARBAND_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ICERAZORS_IRE]: {
    // Custom: Selects and consumes the enhanced Kalla skill profile from live state; see `renegade/mechanics/kalla-and-band-together.ts`.
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
    // Custom: Selects and consumes the enhanced Kalla skill profile from live state; see `renegade/mechanics/kalla-and-band-together.ts`.
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
      { type: 'boon', boon: 'stability', duration: 1, stacks: 1, audience: { recipients: 'self' as const } },
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 3,
        audience: { recipients: 'party' as const },
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
        controlKind: 'daze',
        breakbar: 200
      }
    ],
    legendId: 'LegendaryRenegade'
  },
  [ID.DISMISS_LIEUTENANT_SOULCLEAVE]: {
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep-release',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    flipParentId: ID.SOULCLEAVES_SUMMIT,
    legendId: 'LegendaryRenegade'
  },
  [ID.RAZORCLAWS_RAGE]: {
    // Custom: Selects and consumes the enhanced Kalla skill profile from live state; see `renegade/mechanics/kalla-and-band-together.ts`.
    handlerId: 'revenant.band-together',
    castTimeMs: 500,
    cooldown: 15,
    energyCost: 25,
    effects: BASE_RAZORCLAW_EFFECTS,
    legendId: 'LegendaryRenegade'
  },
  [ID.BREAKRAZORS_BASTION]: {
    // Custom: Selects and consumes the enhanced Kalla skill profile from live state; see `renegade/mechanics/kalla-and-band-together.ts`.
    handlerId: 'revenant.band-together',
    castTimeMs: 750,
    cooldown: 30,
    energyCost: 5,
    effects: BASE_BREAKRAZOR_EFFECTS,
    legendId: 'LegendaryRenegade'
  },
  [ID.SOULCLEAVES_SUMMIT]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
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
      { type: 'boon', boon: 'stability', duration: 1, stacks: 1, audience: { recipients: 'self' as const } },
      { type: 'boon', boon: 'resistance', duration: 4, stacks: 1, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'protection', duration: 4, stacks: 1, audience: { recipients: 'party' as const } },
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 3,
        audience: { recipients: 'party' as const },
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
        controlKind: 'daze',
        breakbar: 600,
        bonusDefianceBreak: 400
      }
    ],
    legendId: 'LegendaryRenegade'
  },
  [ID.BREAKRAZORS_BASTION_ID_72389]: {
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
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.CALL_OF_THE_RENEGADE]: {
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
    simulatorExcluded: true,
    cooldown: 0,
    effects: [],
    ...skill
  };
}

export const RENEGADE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
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
        noCrit: true
      }
    ]
  })
]);
