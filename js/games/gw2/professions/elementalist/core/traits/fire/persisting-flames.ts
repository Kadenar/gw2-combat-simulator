import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Extend authored weapon Fire fields without editing already queued packets. */
export function extendPersistingFlamesEffects(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (
    !hasTrait(context, TRAIT.PERSISTING_FLAMES) ||
    skill.type !== 'Weapon' ||
    !skill.comboFields?.some((field) => field.fieldType === 'Fire')
  )
    return effects;
  const strikes = effects
    .flatMap((effect) =>
      effect.type !== 'strike'
        ? []
        : (
            effect.ticks ?? [
              {
                atMs: 0,
                coefficient: Number(effect.coefficient),
                damageKind: effect.damageKind,
                metadata: effect.metadata
              }
            ]
          )
            .filter((tick) => (tick.damageKind ?? effect.damageKind) === 'field-tick')
            .map((tick) => ({ effect, tick, at: (effect.atMs ?? 0) + tick.atMs }))
    )
    .sort((a, b) => a.at - b.at);
  const last = strikes.at(-1),
    previous = strikes.at(-2);
  if (!last || !previous || last.at <= previous.at) return effects;
  const interval = last.at - previous.at;
  const count = Math.max(
    0,
    Math.trunc(balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PERSISTING_FLAMES), 'summons'))
  );
  const extra: SkillEffect[] = [];
  for (let index = 1; index <= count; index++) {
    extra.push({
      ...last.effect,
      atMs: 0,
      ticks: [
        { ...last.tick, atMs: last.at + interval * index, metadata: { ...last.tick.metadata, largeHitboxOnly: false } }
      ]
    });
    for (const effect of effects) {
      if (effect.type !== 'condition') continue;
      for (const tick of effect.ticks ?? [
        {
          atMs: 0,
          condition: String(effect.condition),
          stacks: Number(effect.stacks),
          duration: Number(effect.duration),
          metadata: effect.metadata
        }
      ]) {
        if ((effect.atMs ?? 0) + tick.atMs === last.at)
          extra.push({
            ...effect,
            atMs: 0,
            ticks: [
              { ...tick, atMs: last.at + interval * index, metadata: { ...tick.metadata, largeHitboxOnly: false } }
            ]
          });
      }
    }
  }

  return [...effects, ...extra];
}

/** Field registration uses the same extension as the extra authored pulses. */
export function extendPersistingFlamesFields(
  context: MechanicQueriesOf<ElementalistRuntime>,
  cast: RuntimeCast<ElementalistSkill>,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  if (!hasTrait(context, TRAIT.PERSISTING_FLAMES) || cast.skill.type !== 'Weapon') return fields;
  const extension = balanceProfileNumber(
    requireBalanceProfileFromContext(context, TRAIT.PERSISTING_FLAMES),
    'durationPerTier'
  );
  return fields?.map((field) =>
    field.fieldType === 'Fire' ? { ...field, duration: Number(field.duration) + extension } : field
  );
}
