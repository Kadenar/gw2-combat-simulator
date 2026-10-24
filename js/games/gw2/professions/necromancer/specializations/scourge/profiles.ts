import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
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
        actorType: ACTOR.PLAYER
      },
      {
        name: CONDITION.TORMENT,
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        name: 'active-shade',
        type: 'buff',
        kind: 'active-shade',
        stacks: 1,
        duration: 15,
        actorType: ACTOR.PLAYER
      }
    ]
  },

  {
    id: SCOURGE_BALANCE_PROFILE_IDS.garishPillar,
    name: 'Garish Pillar - Fear',
    profileKind: 'skill-variant',
    effects: [
      {
        name: CONDITION.FEAR,
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  {
    id: SCOURGE_BALANCE_PROFILE_IDS.desertShroud,
    name: 'Desert Shroud - Pulses',
    profileKind: 'skill-variant',
    // The shared shade attack and pulsing damage arrive after activation; entry traits remain immediate.
    impactDelayMs: 520,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        name: 'Strike',
        type: 'strike',
        ticks: Array.from({ length: 7 }, (_, index) => ({ atMs: index * 1000, coefficient: 3.15 / 7 })),
        actorType: ACTOR.PLAYER
      },
      {
        name: CONDITION.TORMENT,
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 5,
        applications: 7,
        intervalMs: 1000,
        actorType: ACTOR.PLAYER
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
        { name: 'Strike', type: 'strike', coefficient: 3, hits: 1, actorType: ACTOR.PLAYER },
        {
          name: CONDITION.TORMENT,
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 6,
          duration: 5,
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        // Barrier is independent of Protection; its accepted application owns the trait rewards at each pulse.
        name: 'barrier pulses',
        type: 'buff',
        kind: 'barrier',
        stacks: 1,
        duration: 5,
        applications: 3,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY }
      },
      {
        name: 'protection pulses',
        type: 'boon',
        boon: BOON.PROTECTION,
        stacks: 1,
        duration: 1.5,
        applications: 3,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY }
      },
      {
        name: 'barrier detonation',
        type: 'buff',
        kind: 'barrier',
        stacks: 1,
        duration: 5,
        atMs: 3500,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY }
      },
      {
        name: boonKey(BOON.PROTECTION),
        type: 'boon',
        boon: BOON.PROTECTION,
        stacks: 1,
        duration: 3,
        atMs: 3500,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ]
  }
]);
