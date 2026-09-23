import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

export const SCOURGE_BALANCE_PROFILE_IDS = Object.freeze({
  demonicLore: TRAIT.DEMONIC_LORE,
  shade: 'necromancer.scourge.shade',
  sandSavant: TRAIT.SAND_SAVANT,
  abrasiveGrit: TRAIT.ABRASIVE_GRIT,
  desertEmpowerment: TRAIT.DESERT_EMPOWERMENT,
  sadisticSearing: TRAIT.SADISTIC_SEARING,
  garishPillar: 'necromancer.scourge.garish-pillar',
  desertShroud: 'necromancer.scourge.desert-shroud',
  sandstormShroud: 'necromancer.scourge.sandstorm-shroud',
  fellBeacon: TRAIT.FELL_BEACON,
  sandSage: TRAIT.SAND_SAGE,
  nourishingAshes: TRAIT.NOURISHING_ASHES
});

export const SCOURGE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  trait(SCOURGE_BALANCE_PROFILE_IDS.demonicLore, 'Demonic Lore', {
    cooldown: 3,
    effects: [
      {
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'effect'
      }
    ]
  }),
  {
    id: SCOURGE_BALANCE_PROFILE_IDS.shade,
    name: 'Sand Shade',
    profileKind: 'mechanic',
    maximumStacks: 3,
    // Shade-triggered Dhuumfire uses these overrides in combat and trait tooltips.
    dhuumfireDuration: 2,
    dhuumfireInterval: 1,
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0.666,
        hits: 1,
        actorType: 'player'
      },
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        name: 'active-shade',
        type: 'buff',
        kind: 'active-shade',
        stacks: 1,
        duration: 15,
        actorType: 'player'
      }
    ]
  },
  trait(SCOURGE_BALANCE_PROFILE_IDS.sandSavant, 'Sand Savant', {
    maximumStacks: 1,
    rechargePenalty: 1.25,
    effects: [
      {
        name: 'active-shade',
        type: 'buff',
        kind: 'active-shade',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ]
  }),
  trait(SCOURGE_BALANCE_PROFILE_IDS.abrasiveGrit, 'Abrasive Grit', {
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 2,
        duration: 6,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }),
  trait(SCOURGE_BALANCE_PROFILE_IDS.desertEmpowerment, 'Desert Empowerment', {
    effects: [
      {
        name: 'alacrity',
        type: 'boon',
        boon: 'alacrity',
        stacks: 1,
        duration: 1.5,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }),
  trait(SCOURGE_BALANCE_PROFILE_IDS.sadisticSearing, 'Sadistic Searing', {
    effects: [
      {
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  }),
  {
    id: SCOURGE_BALANCE_PROFILE_IDS.garishPillar,
    name: 'Garish Pillar - Fear',
    profileKind: 'skill-variant',
    effects: [{ name: 'Control', type: 'control', actorType: 'player' }]
  },
  {
    id: SCOURGE_BALANCE_PROFILE_IDS.desertShroud,
    name: 'Desert Shroud - Pulses',
    profileKind: 'skill-variant',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        name: 'Strike',
        type: 'strike',
        ticks: Array.from({ length: 7 }, (_, index) => ({ atMs: index * 1000, coefficient: 3.15 / 7 })),
        actorType: 'player'
      },
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 5,
        applications: 7,
        intervalMs: 1000,
        actorType: 'player'
      }
    ])
  },
  {
    id: SCOURGE_BALANCE_PROFILE_IDS.sandstormShroud,
    name: 'Sandstorm Shroud - Pulses',
    profileKind: 'skill-variant',
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      ...impactEffects({ atMs: 3500, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        { name: 'Strike', type: 'strike', coefficient: 3, hits: 1, actorType: 'player' },
        { name: 'Torment', type: 'condition', condition: 'Torment', stacks: 6, duration: 5, actorType: 'player' }
      ]),
      {
        name: 'protection pulses',
        type: 'boon',
        boon: 'protection',
        stacks: 1,
        duration: 1.5,
        applications: 3,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        name: 'protection',
        type: 'boon',
        boon: 'protection',
        stacks: 1,
        duration: 3,
        atMs: 3500,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  },
  trait(SCOURGE_BALANCE_PROFILE_IDS.fellBeacon, 'Fell Beacon', {
    attributeConversion: 0.07
  }),
  trait(SCOURGE_BALANCE_PROFILE_IDS.sandSage, 'Sand Sage', {
    attributeBonus: 225
  }),
  trait(SCOURGE_BALANCE_PROFILE_IDS.nourishingAshes, 'Nourishing Ashes', {
    lifeForceGain: 5,
    cooldown: 3
  })
]);
