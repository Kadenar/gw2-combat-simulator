import { ACTOR } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Each storm hit independently selects Poison from three conditions, using its own reproducible random stream. */
export function scheduleChaosStormPoison(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  // Register the field before its first impact; unsuccessful casts must not create a field or consume its rolls.
  if (cast.cancelled) return;

  const { skill, start: castStart, fullEnd: castEnd, id: activationId } = cast;
  // Read the field-start payload so selection and removal remain local to this cast.
  const effect = requireEffect(skill, 'condition', 'Poison', requireSkillAction(skill, 'poison'));

  if (!effect?.ticks?.length) return;

  const ticks = effect.ticks.filter(() => context.random.roll(1 / 3, 'mesmer.chaos-storm.poison'));

  if (!ticks.length) return;

  for (const application of materializeSkillEffectApplications({
    skill,
    effect: {
      ...effect,
      name: undefined,
      ticks
    },
    start: castStart,
    fullEnd: castEnd,
    baseEvent: {
      activationId,
      source: 'Player',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: skill.name
    }
  })) {
    context.effects.emit({ ...mesmerCastDelivery(cast, skill, Infinity), kind: 'packet', event: application.event });
  }
}
