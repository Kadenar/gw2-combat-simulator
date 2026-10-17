import { BOON } from '#gw2/platform/effects/boons.js';
import { CONDITION } from '#gw2/platform/effects/conditions.js';
/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.KEEN_STRIKE]: {
    interruptCommitMs: 280,
    // Dual Wielding uses the measured commit point for the faster slash.
    dualWieldInterruptCommitMs: 240,
    castTimeMs: 440,
    dualWieldCastTimeMs: 320,
    dualWieldEffectOffsetsMs: { 280: 200 },
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Critical Might consumes the resolver's one sampled outcome; it never rolls again.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'each',
            when: (_runtime, { event, details }) =>
              Number(event.coefficient) > 0 &&
              Boolean(
                details.hitContext?.critEligible &&
                details.hitContext.critical.chance > 0 &&
                details.hitContext.critical.didCrit
              ),
            do: { type: 'warrior.critical-might' }
          }
        ],
        coefficient: 1.05
      },
      {
        type: 'boon',
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 1
      }
    ])
  },
  [ID.FOCUSED_SLASH]: {
    castTimeMs: 360,
    dualWieldCastTimeMs: 240,
    dualWieldEffectOffsetsMs: { 280: 200 },
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.65 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
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
  [ID.WASTRELS_RUIN]: {
    interruptCommitMs: 400,
    cooldown: 12,
    castTimeMs: 440,
    dualWieldCastTimeMs: 320,
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
  [ID.DISRUPTING_STAB]: {
    castTimeMs: 440,
    dualWieldCastTimeMs: 320,
    dualWieldEffectOffsetsMs: { 160: 120 },
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
        controlKind: 'daze'
      }
    ])
  },
  [ID.HUSHBLADE]: {
    interruptCommitMs: 440,
    ammo: 2,
    ammoRecharge: 12,
    cooldown: 12,
    ammoCastLockout: 1,
    castTimeMs: 520,
    dualWieldCastTimeMs: 400,
    // Damage and daze share the measured 80 ms recovery at both attack speeds.
    effects: impactEffects({ atMs: -80, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ])
  },
  [ID.AURA_SLICER]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    // Aura Slicer ignores Quickness and Dual Wielding, so its observed timing stays fixed.
    interruptCommitMs: 760,
    castTimeMs: 840,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        fieldSelectionAnchor: 'castStart',
        ambiguousFieldSelection: 'oldest'
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
