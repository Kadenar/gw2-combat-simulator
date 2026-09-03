import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

export const THIEF_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'thief.core.resources',
  unloadRefund: 'thief.core.unload-refund',
  ashenAssaultRefund: 'thief.core.ashen-assault-refund',
  spiderVenomProc: 'thief.core.spider-venom-proc',
  skaleVenomProc: 'thief.core.skale-venom-proc',
  devourerVenomProc: 'thief.core.devourer-venom-proc',
  fallingSpiderEmpowered: 'thief.core.falling-spider-empowered',
  distractingThrow: 'thief.core.distracting-throw',
  assassinsSignet: 'thief.core.assassins-signet',
  signetsOfPower: TRAIT.SIGNETS_OF_POWER,
  quickPockets: TRAIT.QUICK_POCKETS,
  uncatchable: TRAIT.UNCATCHABLE,
  upperHand: TRAIT.UPPER_HAND,
  serpentsTouch: TRAIT.SERPENTS_TOUCH,
  mug: TRAIT.MUG,
  evenTheOdds: TRAIT.EVEN_THE_ODDS,
  deadlyAmbush: TRAIT.DEADLY_AMBUSH,
  thrillOfTheCrime: TRAIT.THRILL_OF_THE_CRIME,
  bountifulTheft: TRAIT.BOUNTIFUL_THEFT,
  sleightOfHand: TRAIT.SLEIGHT_OF_HAND,
  hiddenThief: TRAIT.HIDDEN_THIEF,
  kleptomaniac: TRAIT.KLEPTOMANIAC,
  enduranceThief: TRAIT.ENDURANCE_THIEF,
  leadAttacks: TRAIT.LEAD_ATTACKS,
  fluidStrikes: TRAIT.FLUID_STRIKES,
  hardToCatch: TRAIT.HARD_TO_CATCH,
  deadlyAmbition: TRAIT.DEADLY_AMBITION,
  unrelentingStrikes: TRAIT.UNRELENTING_STRIKES,
  noQuarter: TRAIT.NO_QUARTER,
  assassinsFury: TRAIT.ASSASSINS_FURY,
  leechingVenoms: TRAIT.LEECHING_VENOMS,
  shadowsRejuvenation: TRAIT.SHADOWS_REJUVENATION,
  shadowSiphoning: TRAIT.SHADOW_SIPHONING,
  panicStrike: TRAIT.PANIC_STRIKE,
  cloakedInShadow: TRAIT.CLOAKED_IN_SHADOW,
  potentPoison: TRAIT.POTENT_POISON,
  keenObserver: TRAIT.KEEN_OBSERVER,
  hiddenKiller: TRAIT.HIDDEN_KILLER,
  revealedTraining: TRAIT.REVEALED_TRAINING,
  sunderingShade: TRAIT.SUNDERING_SHADE,
  improvisation: TRAIT.IMPROVISATION
});

export const THIEF_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Thief Core Resources',
    profileKind: 'mechanic',
    maximumStacks: 12,
    minimumStacks: 15,
    resourceGain: 1,
    kneelingInitiativeRegenerationBonus: 1 / 3,
    resourceCost: 50,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    threshold: 10,
    effects: []
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.unloadRefund,
    name: 'Unload Initiative Refund',
    profileKind: 'skill-variant',
    parentId: ID.UNLOAD,
    resourceGain: 2,
    effects: []
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.ashenAssaultRefund,
    name: 'Ashen Assault Initiative Refund',
    profileKind: 'skill-variant',
    parentId: ID.ASHEN_ASSAULT,
    resourceGain: 4,
    effects: []
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.spiderVenomProc,
    name: 'Spider Venom - Triggered Poison',
    profileKind: 'skill-variant',
    parentId: ID.SPIDER_VENOM,
    maximumStacks: 6,
    durationMultiplier: 24,
    effects: [{ type: 'condition', condition: 'Poisoned', stacks: 1, duration: 3 }]
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.skaleVenomProc,
    name: 'Skale Venom - Triggered Conditions',
    profileKind: 'skill-variant',
    parentId: ID.SKALE_VENOM,
    maximumStacks: 4,
    durationMultiplier: 24,
    effects: [
      { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 10 },
      { type: 'condition', condition: 'Torment', stacks: 1, duration: 3 }
    ]
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.devourerVenomProc,
    name: 'Devourer Venom - Triggered Immobilize',
    profileKind: 'skill-variant',
    parentId: ID.DEVOURER_VENOM,
    maximumStacks: 2,
    durationMultiplier: 24,
    effects: [{ type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1 }]
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.fallingSpiderEmpowered,
    name: 'Falling Spider - Empowered',
    profileKind: 'skill-variant',
    parentId: ID.FALLING_SPIDER,
    damageMultiplier: 1.15,
    resourceGain: 1,
    effects: []
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.distractingThrow,
    name: 'Distracting Throw - Finisher Bonus',
    profileKind: 'skill-variant',
    parentId: ID.DISTRACTING_THROW,
    damageIncrease: 0.1,
    durationMultiplier: 10,
    effects: []
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.assassinsSignet,
    name: "Assassin's Signet",
    profileKind: 'skill-variant',
    parentId: ID.ASSASSINS_SIGNET,
    attributeBonus: 180,
    attributePerStack: 540,
    durationMultiplier: 5,
    effects: []
  },
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.signetsOfPower, 'Signets of Power', {
    resourceGain: 3
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.quickPockets, 'Quick Pockets', {
    internalCooldown: 8,
    resourceGain: 3
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.uncatchable, 'Uncatchable', {
    initialDelay: 0.8,
    pulseInterval: 1,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        applications: 3,
        atMs: 800,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        applications: 3,
        atMs: 800,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.upperHand, 'Upper Hand', {
    internalCooldown: 2,
    resourceGain: 1
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.serpentsTouch, "Serpent's Touch", {
    playerStacks: 3,
    effects: [{ type: 'condition', condition: 'Poisoned', stacks: 2, duration: 10 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.mug, 'Mug', {
    effects: [{ type: 'strike', coefficient: 1.5, hits: 1 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.evenTheOdds, 'Even the Odds', {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      }
    ]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.deadlyAmbush, 'Deadly Ambush', {
    effects: [{ type: 'condition', condition: 'Bleeding', stacks: 3, duration: 10 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.thrillOfTheCrime, 'Thrill of the Crime', {
    effects: [
      { type: 'boon', boon: 'Fury', stacks: 1, duration: 10 },
      { type: 'boon', boon: 'Might', stacks: 5, duration: 10 },
      { type: 'boon', boon: 'Swiftness', stacks: 1, duration: 10 }
    ]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.bountifulTheft, 'Bountiful Theft', {
    effects: [
      { type: 'boon', boon: 'Vigor', stacks: 1, duration: 10 },
      { type: 'boon', boon: 'Might', stacks: 5, duration: 10 }
    ]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.sleightOfHand, 'Sleight of Hand', {
    rechargeMultiplier: 0.8,
    effects: [{ type: 'control', kind: 'daze', duration: 1 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.hiddenThief, 'Hidden Thief', {
    internalCooldown: 2,
    effects: [
      { type: 'condition', condition: 'Blindness', stacks: 1, duration: 3 },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 3 }
    ]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.kleptomaniac, 'Kleptomaniac', {
    resourceGain: 2
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.enduranceThief, 'Endurance Thief', {
    resourceGain: 50
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.leadAttacks, 'Lead Attacks', {
    maximumStacks: 15,
    durationMultiplier: 10,
    damageIncreasePerStack: 0.01,
    rechargeMultiplier: 0.85
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.fluidStrikes, 'Fluid Strikes', {
    damageIncrease: 0.1,
    durationMultiplier: 5
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.hardToCatch, 'Hard to Catch', {
    resourceGain: 8
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.deadlyAmbition, 'Deadly Ambition', {
    playerStacks: 2,
    effects: [{ type: 'condition', condition: 'Poisoned', stacks: 1, duration: 3 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.unrelentingStrikes, 'Unrelenting Strikes', {
    internalCooldown: 8,
    effects: [{ type: 'boon', boon: 'Fury', stacks: 1, duration: 4 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.noQuarter, 'No Quarter', {
    internalCooldown: 2,
    attributeBonus: 250,
    effects: [{ type: 'boon', boon: 'Fury', stacks: 1, duration: 2 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.assassinsFury, "Assassin's Fury", {
    internalCooldown: 2,
    effects: [{ type: 'boon', boon: 'Might', stacks: 3, duration: 8 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.leechingVenoms, 'Leeching Venoms', {
    maximumStacks: 6,
    resourceGain: 3,
    durationMultiplier: 24,
    effects: [{ type: 'strike', coefficient: 0.033, hits: 1 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.shadowsRejuvenation, "Shadow's Rejuvenation", { resourceGain: 1 }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.shadowSiphoning, 'Shadow Siphoning', {
    internalCooldown: 1,
    effects: [{ type: 'strike', coefficient: 0.1, hits: 1 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.panicStrike, 'Panic Strike', {
    threshold: 3,
    internalCooldown: 20,
    playerStacks: 2,
    effects: [
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2.5
      },
      { type: 'condition', condition: 'Poisoned', stacks: 1, duration: 4 }
    ]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.cloakedInShadow, 'Cloaked in Shadow', {
    effects: [{ type: 'strike', coefficient: 0.04, hits: 1 }]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.potentPoison, 'Potent Poison', {
    damageMultiplier: 1.33,
    durationMultiplier: 1.33
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.keenObserver, 'Keen Observer', {
    procChance: 0.15
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.hiddenKiller, 'Hidden Killer', {
    procChance: 1,
    durationMultiplier: 1
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.revealedTraining, 'Revealed Training', {
    attributeBonus: 80,
    attributePerStack: 120
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.sunderingShade, 'Sundering Shade', {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 5
      }
    ]
  }),
  trait(THIEF_CORE_BALANCE_PROFILE_IDS.improvisation, 'Improvisation', {
    maximumStacks: 2,
    internalCooldown: 15,
    rechargeMultiplier: 0.75,
    resourceGain: 1
  })
]);
