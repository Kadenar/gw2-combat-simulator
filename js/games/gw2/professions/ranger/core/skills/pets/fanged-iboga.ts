import { ACTOR, CONTROL, COMBO_FIELD, CONDITION } from '#gw2/platform/constants.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import { packAlphaPetRecharge } from '#gw2/professions/ranger/core/traits/beastmastery/pet-attributes.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
/**
 * Owns Core Ranger pet skill fragments for the Fanged Iboga family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_FANGED_IBOGA_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FANG_GRAPPLE]: {
    petSkill: true,
    quicknessCastTimeMs: 1000,
    effects: impactEffects({ atMs: 1040, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        controlKind: CONTROL.PULL
      }
    ])
  },
  [ID.CONSUMING_BITE]: {
    petSkill: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.45 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.CRIPPLING_ANGUISH_PET]: {
    petSkill: true,
    quicknessCastTimeMs: 600,
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 4,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 10,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  },
  [ID.NARCOTIC_SPORES_PET]: {
    petSkill: true,
    quicknessCastTimeMs: 720,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: COMBO_FIELD.ETHEREAL,
        duration: 6,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          coefficient: 0.1
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          condition: CONDITION.CONFUSION,
          stacks: 1,
          duration: 8
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }
});

/** Intrinsic live-impact policy stays beside its skill; the shared registry supplies resolution. */
export const rangerConsumingBiteModifier: Gw2ModifierRule = {
  id: 'ranger.consuming-bite-condition-count',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  parameters: {
    maximumConditions: 5,
    coefficientPerCondition: 0.025
  },
  factor: (context, _target, parameters) => {
    const coefficient = Number(context.event?.coefficient || 0);

    if (!(coefficient > 0)) return 1;

    const conditions = Math.min(parameters.maximumConditions, targetConditionCount(context));
    return (coefficient + conditions * parameters.coefficientPerCondition) / coefficient;
  },
  when: (context) => Number(context.event?.skillId ?? context.skillId) === ID.CONSUMING_BITE
};

/** Preserve the Iboga's autonomous policy, including its independent Quickness recharge, outside the scheduler. */
export function ibogaAutonomousRecharge(context: RangerRuntime, skill: Skill, quickness: boolean): number | undefined {
  const profileId =
    skill.id === ID.NARCOTIC_SPORES_PET
      ? PROFILE.narcoticSporesAutonomous
      : skill.id === ID.CRIPPLING_ANGUISH_PET
        ? quickness
          ? PROFILE.cripplingAnguishQuickness
          : PROFILE.cripplingAnguishAutonomous
        : undefined;

  if (!profileId) return undefined;

  const cooldown = balanceNumberFromContext(context, profileId, 'cooldown');
  return profileId === PROFILE.cripplingAnguishQuickness ? cooldown : cooldown * packAlphaPetRecharge(context);
}
