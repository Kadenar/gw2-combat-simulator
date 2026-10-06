import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { EPSILON } from '#kernel/core/clock.js';
/**
 * Owns Primordial Stance's scheduled pulses against the live Weaver attunement pair.
 * Skill packet templates remain in `skills/slot-skills.ts`.
 */
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistConditionRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
/** Reads canonical condition timing without emitting packets that the live-attunement tasks replace. */
export function schedulePrimordialStance(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const tickTimes = new Set<number>();
  for (const effect of skill.effects || []) {
    if (effect.type !== 'condition') continue;
    const timing = scaleCastBoundTiming(cast, skill, effect);
    const applications = materializeSkillEffectApplications({
      skill,
      effect: timing,
      start: cast.start,
      fullEnd: cast.fullEnd,
      baseEvent: { source: 'elementalist', sourceId: skill.id, actorType: 'player' }
    });
    for (const { at } of applications) {
      // Preserve the activation-time exclusion and coalesce coincident condition applications.
      if (at > cast.effectiveEnd + EPSILON) tickTimes.add(at);
    }
  }

  for (const at of [...tickTimes].sort((a, b) => a - b))
    context.scheduleForCast('elementalist.primordial-stance', at, cast, {}, { id: cast.id, generation: 0 });
}

/** Resolves one Primordial Stance pulse against the attunements live at its timestamp. */
function emitPrimordialStancePulse(
  context: ElementalistRuntime,
  at: number,
  captured: {
    readonly sourceId: Skill['id'];
  },
  emissionCast?: EffectDelivery['cast']
): void {
  const core = professionCoreState(context);
  const state = weaverState.from(context);
  const sourceId = captured.sourceId;
  const attunements = state.secondaryAttunement
    ? [core.primaryAttunement, state.secondaryAttunement]
    : [core.primaryAttunement];
  const primordialStanceProfile = requireBalanceProfileFromContext(context, PROFILE.primordialStance);
  const strike = requireEffect(primordialStanceProfile, 'strike', 'Primordial Stance');
  if (strike)
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          at,
          source: 'elementalist',
          sourceId,
          actorType: 'player',
          skillName: 'Primordial Stance',
          skillId: sourceId,
          coefficient: Number(strike.coefficient),
          skillWeapon: 'Unequipped',
          damageKind: 'field-tick'
        },
        emissionCast
      )
    );
  for (const attunement of attunements) {
    const effect = requireEffect(primordialStanceProfile, 'condition', attunement);
    if (!effect) continue;
    context.effects.emit(
      elementalistConditionRequest(
        {
          at,
          source: 'Primordial Stance',
          sourceId,
          skillName: 'Primordial Stance',
          condition: String(effect.condition),
          stacks: Number(effect.stacks),
          duration: Number(effect.duration)
        },
        emissionCast
      )
    );
  }
}

/** Every pulse retains the cast targeting policy but reads the current hand pair. */
export function primordialStancePulse(runtime: ElementalistRuntime, data: unknown): void {
  const { cast } = data as {
    cast: RuntimeCast<ElementalistSkill>;
  };
  emitPrimordialStancePulse(
    runtime,
    runtime.time,
    { sourceId: cast.skill.id },
    { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
  );
}
