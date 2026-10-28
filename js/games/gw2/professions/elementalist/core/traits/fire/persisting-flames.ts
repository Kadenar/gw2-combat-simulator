import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { COMBO_FIELD } from '#gw2/platform/constants.js';
import { extendPeriodicEffects } from '#gw2/platform/effects/periodic.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Weapon Fire fields keep pulsing their repeated payloads through the added lifetime, on each payload's own interval. */
export function extendPersistingFlamesEffects(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (
    !hasTrait(context, TRAIT.PERSISTING_FLAMES) ||
    skill.type !== 'Weapon' ||
    !skill.comboFields?.some((field) => field.fieldType === COMBO_FIELD.FIRE)
  )
    return effects;

  const extension = balanceNumberFromContext(context, TRAIT.PERSISTING_FLAMES, 'durationPerTier');
  return extendPeriodicEffects(effects, Math.round(extension * 1000));
}

/** Field registration uses the same extension as the repeated field pulses. */
export function extendPersistingFlamesFields(
  context: MechanicQueriesOf<ElementalistRuntime>,
  cast: RuntimeCast<ElementalistSkill>,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  if (!hasTrait(context, TRAIT.PERSISTING_FLAMES) || cast.skill.type !== 'Weapon') return fields;

  const extension = balanceNumberFromContext(context, TRAIT.PERSISTING_FLAMES, 'durationPerTier');
  return fields?.map((field) =>
    field.fieldType === COMBO_FIELD.FIRE ? { ...field, duration: Number(field.duration) + extension } : field
  );
}
