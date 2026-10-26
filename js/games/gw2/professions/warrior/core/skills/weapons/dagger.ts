import { ACTOR, RECIPIENT, CONTROL, COMBO_FINISHER, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PRECISE_CUT]: {
    castTimeMs: 320,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        // The slash retains 40 ms of recovery at either measured attack speed.
        coefficient: 0.6,
        atMs: -40,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FOCUSED_SLASH]: {
    dualWieldEffectOffsetsMs: { 280: 200 },
    castTimeMs: 360,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.65 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.KEEN_STRIKE]: {
    dualWieldEffectOffsetsMs: { 280: 200 },
    castTimeMs: 440,
    dualWieldCastTimeMs: 320,
    interruptCommitMs: 280,
    // Dual Wielding uses the measured commit point for the faster slash.
    dualWieldInterruptCommitMs: 240,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Critical Might consumes the resolver's one sampled outcome; it never rolls again.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event, details }) =>
              Number(event.coefficient) > 0 &&
              Boolean(
                details.hitContext?.critEligible &&
                details.hitContext.critical.chance > 0 &&
                details.hitContext.critical.didCrit
              ),
            // Critical Might belongs to this landed strike and is never an ordinary cast reward.
            do: {
              type: 'warrior.critical-might',
              id: 'critical-might',
              effects: [
                {
                  name: BOON.MIGHT,
                  type: 'boon',
                  boon: BOON.MIGHT,
                  audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
                  stacks: 1,
                  duration: 5
                }
              ]
            }
          }
        ],
        coefficient: 1.05
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 1
      }
    ])
  },
  [ID.AURA_SLICER]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 840,
    // Aura Slicer ignores Quickness and Dual Wielding, so its observed timing stays fixed.
    interruptCommitMs: 760,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.LEAP,
        fieldSelectionAnchor: 'castStart'
      }
    ],

    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 1.5
      }
    ])
  },
  [ID.DISRUPTING_STAB]: {
    dualWieldEffectOffsetsMs: { 160: 120 },
    castTimeMs: 440,
    dualWieldCastTimeMs: 320,
    dualWieldInterruptCommitMs: 160,
    retainsCastLockoutAfterInterrupt: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 160, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.2
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ])
  },
  [ID.WASTRELS_RUIN]: {
    cooldown: 12,
    castTimeMs: 440,
    dualWieldCastTimeMs: 320,
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        // The impact follows the full cast's recovery boundary, independent of an interruption.
        coefficient: 1.5,
        atMs: -40,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HUSHBLADE]: {
    ammo: 2,
    ammoRecharge: 12,
    cooldown: 12,
    ammoCastLockout: 1,
    castTimeMs: 520,
    dualWieldCastTimeMs: 400,
    interruptCommitMs: 440,
    // Damage and daze share the measured 80 ms recovery at both attack speeds.
    effects: impactEffects({ atMs: -80, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ])
  }
});

/** Intrinsic live modifiers retain critical semantics and the simulator's boonless-target assumption. */
export const warriorDaggerSkillModifiers: readonly Gw2ModifierRule[] = [
  {
    id: 'warrior.dagger-auto-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => {
      const skillId = Number(skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id);
      return skillId === ID.PRECISE_CUT || skillId === ID.FOCUSED_SLASH;
    }
  },
  {
    id: 'warrior.wastrels-ruin-defiant',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    order: 100,
    when: (context) =>
      skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.WASTRELS_RUIN &&
      context.config?.target?.defiant === true
  }
];
