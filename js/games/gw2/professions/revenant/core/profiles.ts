// Give same-type condition packets distinct names so patch deletion cannot select a sibling.
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
/**
 * Owns Core Revenant balance profiles shared by skills, mechanics, and traits.
 * Skill catalogs live in sibling `skills/` modules.
 */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT,
  REVENANT_SKILL_IDS as ID
} from '#gw2/professions/revenant/data/ids.js';
import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';

export const REVENANT_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'revenant.core.resources',
  invokersRage: TRAIT.INVOKERS_RAGE,
  incensedResponse: TRAIT.INCENSED_RESPONSE,
  enduringRecovery: TRAIT.ENDURING_RECOVERY,
  battleScars: 'revenant.core.battle-scars',
  spiritBoon: TRAIT.SPIRIT_BOON,
  songOfTheMists: TRAIT.SONG_OF_THE_MISTS,
  chargedMists: TRAIT.CHARGED_MISTS,
  invokingTorment: TRAIT.INVOKING_TORMENT,
  battleScarred: TRAIT.BATTLE_SCARRED,
  thrillOfCombat: TRAIT.THRILL_OF_COMBAT,
  abyssalChill: TRAIT.ABYSSAL_CHILL,
  assassinsPresence: TRAIT.ASSASSINS_PRESENCE,
  brutality: TRAIT.BRUTALITY,
  dwarvenBattleTraining: TRAIT.DWARVEN_BATTLE_TRAINING,
  exposeDefenses: TRAIT.EXPOSE_DEFENSES,
  viciousReprisal: TRAIT.VICIOUS_REPRISAL,
  notoriety: TRAIT.NOTORIETY
});

export const REVENANT_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // Serene Rejuvenation supports Centaur boon applications; outgoing healing remains outside scope.
  {
    id: TRAIT.SERENE_REJUVENATION,
    name: 'Serene Rejuvenation',
    profileKind: 'trait',
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 2,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 },
        metadata: { trigger: String(ID.NATURAL_HARMONY) }
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 },
        metadata: { trigger: String(ID.PURIFYING_ESSENCE) }
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 },
        metadata: { trigger: String(ID.PROTECTIVE_SOLACE) }
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 4,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 },
        metadata: { trigger: String(ID.ENERGY_EXPULSION) }
      }
    ]
  },
  // Keep the missing Invocation boons and Retribution resource bonus patchable with their owning traits.
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.invokersRage,
    name: "Invoker's Rage",
    profileKind: 'trait',
    effects: [{ type: 'boon', boon: 'fury', duration: 5, stacks: 1 }]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.incensedResponse,
    name: 'Incensed Response',
    profileKind: 'trait',
    effects: [{ type: 'boon', boon: 'might', duration: 8, stacks: 5 }]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.enduringRecovery,
    name: 'Enduring Recovery',
    profileKind: 'trait',
    enduranceRegenerationMultiplier: 1.25,
    effects: []
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Revenant Resources',
    profileKind: 'mechanic',
    energyRegenerationPerSecond: 5,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    effects: []
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.chargedMists,
    name: 'Charged Mists',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    resourceGain: 75,
    threshold: 10,
    effects: []
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars,
    name: 'Battle Scars',
    profileKind: 'mechanic',
    maximumStacks: 25,
    effects: [
      {
        type: 'buff',
        kind: 'battle-scars',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 117,
        flatStrikePowerCoeff: 0.006,
        name: 'Battle Scars — Life Siphon',
        actorType: 'effect'
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.battleScarred,
    name: 'Battle Scarred',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'buff',
        kind: 'battle-scars',
        duration: 10,
        stacks: 5,
        actorType: 'player'
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.thrillOfCombat,
    name: 'Thrill of Combat',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 1,
    effects: [
      {
        type: 'buff',
        kind: 'battle-scars',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.abyssalChill,
    name: 'Abyssal Chill',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.assassinsPresence,
    name: "Assassin's Presence",
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 10,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.brutality,
    name: 'Brutality',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 9,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.dwarvenBattleTraining,
    name: 'Dwarven Battle Training',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.exposeDefenses,
    name: 'Expose Defenses',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.viciousReprisal,
    name: 'Vicious Reprisal',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 1,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  {
    attributePerStack: 10,
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.notoriety,
    name: 'Notoriety',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 2,
        actorType: 'player'
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.spiritBoon,
    name: 'Spirit Boon (Core Legends)',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 2,
        actorType: 'player',
        metadata: { legendId: LEGEND.ASSASSIN }
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 2,
        stacks: 1,
        actorType: 'player',
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1,
        actorType: 'player',
        metadata: { legendId: LEGEND.DWARF }
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1,
        actorType: 'player',
        metadata: { legendId: LEGEND.CENTAUR }
      }
    ]
  },
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.songOfTheMists,
    name: 'Song of the Mists (Core Legends)',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Call of the Assassin',
        actorType: 'player',
        metadata: { legendId: LEGEND.ASSASSIN }
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 5,
        name: 'Call of the Assassin',
        actorType: 'player',
        metadata: { legendId: LEGEND.ASSASSIN }
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 2,
        stacks: 1,
        name: 'Call of the Assassin',
        actorType: 'player',
        metadata: { legendId: LEGEND.ASSASSIN }
      },
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Call of the Dwarf',
        actorType: 'player',
        metadata: { legendId: LEGEND.DWARF }
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        name: 'Call of the Dwarf',
        actorType: 'player',
        metadata: { legendId: LEGEND.DWARF }
      },
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Call of the Demon',
        actorType: 'player',
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 3,
        name: 'Call of the Demon - Slow',
        skillName: 'Call of the Demon',
        actorType: 'player',
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 8,
        name: 'Call of the Demon - Torment',
        skillName: 'Call of the Demon',
        actorType: 'player',
        metadata: { legendId: LEGEND.DEMON }
      }
    ]
  },
  trait(TRAIT.SEETHING_MALICE, 'Seething Malice', {
    attributeBonus: 120
  }),
  trait(TRAIT.LIFE_ATTUNEMENT, 'Life Attunement', {
    attributeConversion: 0.07,
    attributeBonus: 120
  }),
  trait(TRAIT.VERSED_IN_STONE, 'Versed in Stone', {
    attributeConversion: 0.13
  }),
  trait(TRAIT.YEARNING_EMPOWERMENT, 'Yearning Empowerment', {
    conditionDurationBonus: 0.1
  }),
  trait(TRAIT.ROILING_MISTS, 'Roiling Mists', {
    criticalChance: 0.25
  }),
  trait(TRAIT.PACT_OF_PAIN, 'Pact of Pain', {
    conditionDurationBonus: 0.15
  }),
  {
    id: REVENANT_CORE_BALANCE_PROFILE_IDS.invokingTorment,
    // Keep the invocation strike and its conditions together on the nearest action tick.
    name: 'Invoke Torment',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Invoke Torment',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 10,
        name: 'Invoke Torment - Torment',
        skillName: 'Invoke Torment',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 10,
        name: 'Invoke Torment - Poisoned',
        skillName: 'Invoke Torment',
        actorType: 'player',
        metadata: { trigger: 'diabolic-inferno' }
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        name: 'Invoke Torment - Burning',
        skillName: 'Invoke Torment',
        actorType: 'player',
        metadata: { trigger: 'diabolic-inferno' }
      }
    ])
  }
] satisfies readonly BalanceProfile[]);
