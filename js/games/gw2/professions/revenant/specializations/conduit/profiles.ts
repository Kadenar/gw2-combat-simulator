import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
/** Owns patchable Conduit mechanic, trait, and skill-variant balance profiles. */
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';

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
  mesmerPainAbsorption: 'revenant.conduit.mesmer-pain-absorption',
  mesmerEmpoweringMisery: 'revenant.conduit.mesmer-empowering-misery',
  mesmerCallToAnguish: 'revenant.conduit.mesmer-call-to-anguish',
  mesmerUnyieldingImpact: 'revenant.conduit.mesmer-unyielding-impact',
  mesmerEmbraceTheDarkness: 'revenant.conduit.mesmer-embrace-the-darkness'
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
    castTimeMs: 360,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp,
    name: 'Beguiling Haze (Follow-Up)',
    profileKind: 'skill-variant',
    castTimeMs: 240,
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
        name: 'cosmic-wisdom-extension',
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
        name: 'entity-skill',
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        stacks: 1,
        metadata: { trigger: 'entity-skill' }
      },
      {
        name: 'beguiling-haze',
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1,
        metadata: { trigger: 'beguiling-haze' }
      },
      {
        name: 'hex-eater-vortex',
        type: 'boon',
        boon: 'resolution',
        duration: 3,
        stacks: 1,
        metadata: { trigger: 'hex-eater-vortex' }
      },
      {
        name: 'gladiators-defense',
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1,
        metadata: { trigger: 'gladiators-defense' }
      },
      {
        name: 'twin-moon-sweep',
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
    conditionDurationBonus: 0.05,
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

  trait(TRAIT.BOLSTERED_BONDS, 'Bolstered Bonds', {
    assassinAttributeBonus: 75,
    centaurAttributeBonus: 150,
    demonAttributeBonus: 75,
    dwarfAttributeBonus: 150,
    entityAttributeBonus: 75,
    attributeMultiplier: 2
  }),
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
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        actorType: 'effect'
      }
    ]
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerEmpoweringMisery,
    name: 'Empowering Misery (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 1,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerPainAbsorption,
    name: 'Pain Absorption (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 10,
    cooldown: 5,
    effects: []
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
