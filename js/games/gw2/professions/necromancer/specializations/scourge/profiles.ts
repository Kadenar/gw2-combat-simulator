import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const SCOURGE_BALANCE_PROFILE_IDS = Object.freeze({
  shade: 'necromancer.scourge.shade',
  garishPillar: 'necromancer.scourge.garish-pillar',
  desertShroud: 'necromancer.scourge.desert-shroud',
  sandstormShroud: 'necromancer.scourge.sandstorm-shroud'
});

export const SCOURGE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
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
  }
]);
