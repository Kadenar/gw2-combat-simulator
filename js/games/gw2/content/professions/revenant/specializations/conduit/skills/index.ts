/**
 * Conduit skill mechanics owned by the Conduit Revenant module.
 */
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '../../../data/ids.js';
import type { BalanceProfile, SkillFragment } from '../../../../../../platform/engine/types.js';

export const CONDUIT_BALANCE_PROFILE_IDS = Object.freeze({
  affinity: 'revenant.conduit.affinity',
  beguilingHazeMainCastExtension: 'revenant.conduit.beguiling-haze-main-cast-extension',
  beguilingHazeFollowUp: 'revenant.conduit.beguiling-haze-follow-up',
  lingeringDetermination: 'revenant.conduit.lingering-determination',
  enhancedEmbodiment: 'revenant.conduit.enhanced-embodiment',
  expandedConsciousness: 'revenant.conduit.expanded-consciousness',
  sharedWisdom: 'revenant.conduit.shared-wisdom',
  numinousGift: 'revenant.conduit.numinous-gift',
  mistfire: 'revenant.conduit.mistfire',
  mesmerBanishEnchantment: 'revenant.conduit.mesmer-banish-enchantment',
  mesmerCallToAnguish: 'revenant.conduit.mesmer-call-to-anguish',
  mesmerUnyieldingImpact: 'revenant.conduit.mesmer-unyielding-impact',
  mesmerEmbraceTheDarkness: 'revenant.conduit.mesmer-embrace-the-darkness'
});

const BEGUILING_HAZE_EFFECTS = Object.freeze([
  {
    type: 'strike',
    name: 'Beguiling Haze',
    actorType: 'player',
    ticks: [{ atMs: 522, coefficient: 2.2 }],
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  }
] as const);

const HEX_EATER_VORTEX_EFFECTS = Object.freeze([
  {
    type: 'strike',
    name: 'Hex-Eater Vortex',
    actorType: 'player',
    ticks: [443, 562, 682, 802, 920, 1039].map((atMs) => ({
      atMs,
      coefficient: 0.2
    })),
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  },
  {
    type: 'condition',
    name: 'Hex-Eater Vortex',
    actorType: 'player',
    ticks: [443, 562, 682, 802, 920, 1039].map((atMs) => ({
      atMs,
      condition: 'Torment',
      stacks: 1,
      duration: 1.5
    })),
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  }
] as const);

const GLADIATORS_DEFENSE_EFFECTS = Object.freeze([
  {
    type: 'strike',
    coefficient: 1.5,
    hits: 1,
    name: "Gladiator's Defense",
    actorType: 'player'
  },
  {
    type: 'condition',
    condition: 'Weakness',
    stacks: 1,
    duration: 5,
    actorType: 'player'
  },
  { type: 'boon', boon: 'resolution', duration: 3, stacks: 1 },
  { type: 'boon', boon: 'resistance', duration: 3, stacks: 1 }
] as const);

const TWIN_MOON_SWEEP_EFFECTS = Object.freeze([
  {
    type: 'strike',
    coefficient: 2.5,
    hits: 1,
    name: 'Twin Moon Sweep — Player',
    actorType: 'player',
    atMs: 880,
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { affinityOnHit: true }
  },
  {
    type: 'strike',
    coefficient: 2.5,
    hits: 1,
    name: 'Twin Moon Sweep — Fragment',
    actorType: 'player',
    atMs: 880,
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  },
  {
    type: 'condition',
    condition: 'Bleeding',
    stacks: 2,
    duration: 3,
    applications: 2,
    intervalMs: 0,
    actorType: 'player',
    atMs: 880,
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  },
  {
    type: 'boon',
    boon: 'might',
    stacks: 2,
    duration: 8,
    applications: 2,
    intervalMs: 0,
    atMs: 880,
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  },
  {
    type: 'condition',
    condition: 'Immobilized',
    stacks: 1,
    duration: 2,
    actorType: 'player',
    atMs: 880,
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { legendId: LEGEND.ASSASSIN }
  },
  {
    type: 'strike',
    coefficient: 0.4,
    hits: 2,
    intervalMs: 0,
    name: 'Twin Moon Sweep — Shatter',
    actorType: 'player',
    atMs: 1402,
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { legendId: LEGEND.DEMON }
  },
  {
    type: 'condition',
    condition: 'Confusion',
    stacks: 3,
    duration: 3,
    applications: 2,
    intervalMs: 0,
    actorType: 'player',
    atMs: 1402,
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { legendId: LEGEND.DEMON }
  }
] as const);

export const CONDUIT_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BEGUILING_HAZE_ID_76805]: {
    implemented: true,
    handlerId: 'revenant.beguiling-haze',
    castTimeMs: 250,
    cooldown: 10,
    recharge: 0,
    ammo: 1,
    ammoRecharge: 10,
    energyCost: 20,
    effects: BEGUILING_HAZE_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.FORM_OF_THE_DERVISH_ATTACK]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Form of the Dervish (Attack)',
        actorType: 'player'
      }
    ]
  },
  [ID.BEGUILING_HAZE_ID_76917]: {
    implemented: true,
    handlerId: 'revenant.beguiling-haze',
    castTimeMs: 250,
    cooldown: 10,
    recharge: 0,
    ammo: 1,
    ammoRecharge: 10,
    energyCost: 20,
    effects: BEGUILING_HAZE_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.TWIN_MOON_SWEEP]: {
    implemented: true,
    handlerId: 'revenant.twin-moon-sweep',
    quicknessCastTimeMs: 920,
    cooldown: 3,
    energyCost: 25,
    affinityOnHit: true,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: 'Whirl',
        applications: 2,
        effectDelay: 0.04,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: TWIN_MOON_SWEEP_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.TWIN_MOON_SWEEP_ID_77001]: {
    implemented: true,
    handlerId: 'revenant.twin-moon-sweep',
    quicknessCastTimeMs: 920,
    cooldown: 3,
    energyCost: 25,
    affinityOnHit: true,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: 'Whirl',
        applications: 2,
        effectDelay: 0.04,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: TWIN_MOON_SWEEP_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.SHIELDING_HANDS]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 30,
    energyCost: 5,
    effects: [],
    legendId: 'LegendaryEntity'
  },
  [ID.FORM_OF_THE_DERVISH_ATTACK_ELITE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Form of the Dervish (Attack - Elite)',
        actorType: 'player'
      }
    ]
  },
  [ID.BEGUILING_HAZE]: {
    implemented: true,
    handlerId: 'revenant.beguiling-haze',
    castTimeMs: 250,
    cooldown: 10,
    recharge: 0,
    ammo: 1,
    ammoRecharge: 10,
    energyCost: 20,
    effects: BEGUILING_HAZE_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.BEGUILING_HAZE_ID_77159]: {
    implemented: true,
    handlerId: 'revenant.beguiling-haze',
    castTimeMs: 250,
    cooldown: 10,
    recharge: 0,
    ammo: 1,
    ammoRecharge: 10,
    energyCost: 20,
    effects: BEGUILING_HAZE_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.HEX_EATER_VORTEX]: {
    implemented: true,
    handlerId: 'revenant.hex-eater-vortex',
    quicknessCastTimeMs: 526,
    cooldown: 5,
    energyCost: 15,
    effects: HEX_EATER_VORTEX_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.GLADIATORS_DEFENSE]: {
    implemented: true,
    handlerId: 'revenant.gladiators-defense',
    castTimeMs: 40,
    defaultInterruptMs: 40,
    cooldown: 5,
    energyCost: 10,
    effects: GLADIATORS_DEFENSE_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.COSMIC_WISDOM]: {
    implemented: true,
    handlerId: 'revenant.cosmic-wisdom',
    castTimeMs: 0,
    cooldown: 20,
    energyCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'cosmic-wisdom',
        duration: 7,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.DWARVEN_RETRIBUTION]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Dwarven Retribution',
        actorType: 'player'
      }
    ]
  },
  [ID.RELEASE_POTENTIAL_MONK]: {
    implemented: true,
    handlerId: 'revenant.release-potential',
    castTimeMs: 500,
    cooldown: 10,
    energyCost: 0,
    effects: [
      { type: 'boon', boon: 'resistance', duration: 2, stacks: 1 },
      { type: 'boon', boon: 'regeneration', duration: 6, stacks: 1 }
    ]
  },
  [ID.RELEASE_POTENTIAL_MESMER]: {
    implemented: true,
    handlerId: 'revenant.release-potential',
    quicknessCastTimeMs: 440,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.98,
        hits: 1,
        name: 'Release Potential: Mesmer',
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 3,
        durationPerAffinity: 0.1,
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 8,
        durationReductionPerAffinity: 0.15,
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { target: 'self' }
      },
      {
        type: 'control',
        duration: 2,
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { controlKind: 'daze', breakbar: 200 }
      }
    ]
  },
  [ID.RELEASE_POTENTIAL_DERVISH]: {
    implemented: true,
    handlerId: 'revenant.release-potential',
    quicknessCastTimeMs: 680,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.98,
        hits: 1,
        name: 'Release Potential: Dervish',
        actorType: 'player',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        actorType: 'player',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 10,
        duration: 8,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { legendId: LEGEND.CENTAUR }
      },
      {
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 8,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { legendId: LEGEND.CENTAUR }
      }
    ]
  },
  [ID.RELEASE_POTENTIAL_ASSASSIN]: {
    implemented: true,
    handlerId: 'revenant.release-potential',
    quicknessCastTimeMs: 740,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        name: 'Release Potential: Assassin',
        actorType: 'player',
        ticks: [160, 480, 800].map((atMs) => ({
          atMs,
          coefficient: 0.6
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        durationPerAffinity: 0.2,
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        durationPerAffinity: 0.2,
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RELEASE_POTENTIAL_WARRIOR]: {
    implemented: true,
    handlerId: 'revenant.release-potential',
    castTimeMs: 750,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.649,
        hits: 1,
        name: 'Release Potential: Warrior',
        actorType: 'player'
      }
    ]
  },
  [ID.LESSER_ENCHANTED_DAGGERS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.06,
        hits: 1,
        name: 'Lesser Enchanted Daggers',
        actorType: 'player'
      }
    ]
  },
  [ID.LEGENDARY_ENTITY_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.PAIN_ABSORPTION_ID_78505]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 0,
    effects: []
  },
  [ID.BANISH_ENCHANTMENT_ID_78587]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 0,
    effects: []
  },
  [ID.EMPOWERING_MISERY_ID_78681]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    energyCost: 0,
    effects: []
  }
});

export const CONDUIT_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.affinity,
    name: 'Affinity',
    profileKind: 'mechanic',
    maximumStacks: 5,
    minimumStacks: 3,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension,
    name: 'Beguiling Haze (Main Cast Extension)',
    profileKind: 'skill-variant',
    castTimeMs: 400,
    quicknessCastMultiplier: 0.9,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp,
    name: 'Beguiling Haze (Follow-Up)',
    profileKind: 'skill-variant',
    castTimeMs: 250,
    quicknessCastMultiplier: 0.96,
    maximumStacks: 2,
    effects: [
      {
        type: 'strike',
        name: 'Beguiling Haze — Follow-Up',
        actorType: 'player',
        ticks: [{ atMs: 200, coefficient: 0.6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.lingeringDetermination,
    name: 'Lingering Determination',
    profileKind: 'trait',
    resourceGain: 2,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.enhancedEmbodiment,
    name: 'Enhanced Embodiment',
    profileKind: 'trait',
    rechargeMultiplier: 0.6,
    effects: [
      {
        type: 'buff',
        kind: 'cosmic-wisdom-extension',
        duration: 1,
        stacks: 1
      }
    ]
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.expandedConsciousness,
    name: 'Expanded Consciousness',
    profileKind: 'trait',
    resourceGain: 15,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.sharedWisdom,
    name: 'Shared Wisdom',
    profileKind: 'trait',
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        stacks: 1,
        metadata: { trigger: 'entity-skill' }
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1,
        metadata: { trigger: 'beguiling-haze' }
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 3,
        stacks: 1,
        metadata: { trigger: 'hex-eater-vortex' }
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1,
        metadata: { trigger: 'gladiators-defense' }
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5,
        applications: 2,
        atMs: 0,
        intervalMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { trigger: 'twin-moon-sweep' }
      }
    ]
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.numinousGift,
    name: 'Numinous Gift',
    profileKind: 'trait',
    effects: [
      { type: 'boon', boon: 'might', duration: 10, stacks: 5 },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1,
        metadata: { legendId: LEGEND.ASSASSIN }
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.DWARF }
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.CENTAUR }
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.ENTITY }
      }
    ]
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mistfire,
    name: 'Mistfire',
    profileKind: 'trait',
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Mistfire',
        actorType: 'effect'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        actorType: 'effect'
      }
    ]
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerBanishEnchantment,
    name: 'Banish Enchantment (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 5,
    cooldown: 5,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerCallToAnguish,
    name: 'Call to Anguish (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 10,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerUnyieldingImpact,
    name: 'Unyielding Impact (Form of the Mesmer)',
    profileKind: 'skill-variant',
    // Mesmer-form skills retain their one-Energy activation cost; Embrace's upkeep drain starts separately on completion.
    energyCost: 1,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerEmbraceTheDarkness,
    name: 'Embrace the Darkness (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 1,
    effects: []
  }
]);
