import { COMBO_FINISHER, COMBO_FIELD, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { conditionTimeline, impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BLAZE_BREAKER]: {
    cooldown: 12,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.BLAST,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    castTimeMs: 480,
    // Preserve committed blast effects and hold the cast lane through the remaining animation.
    interruptCommitMs: 440,
    interruptMode: 'commit',
    retainsCastLockoutAfterInterrupt: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.4
        },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 6
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 3
        }
      ]
    )
  },
  [ID.FLAMES_OF_WAR]: {
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: COMBO_FIELD.FIRE,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    castTimeMs: 520,
    // Group identical Burning pulses separately from the explosion's stronger, longer Burning.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        atMs: 5480,
        coefficient: 1
      },
      conditionTimeline(
        [480, 1480, 2480, 3480, 4480].map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 2
        }))
      ),
      {
        type: 'condition',
        atMs: 5480,
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 6
      }
    ])
  }
});
