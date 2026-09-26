import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { EPSILON } from '#kernel/core/clock.js';
/**
 * Owns Primordial Stance's scheduled pulses against the live Weaver attunement pair.
 * Skill packet templates remain in `skills/slot-skills.ts`.
 */
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitElementalistCondition, emitElementalistDamage } from '#gw2/professions/elementalist/core/events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { materializeSkillEffectApplications, scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Reads canonical condition timing without emitting packets that the live-attunement tasks replace. */
export function schedulePrimordialStance(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
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
    context.schedule('elementalist.primordial-stance', at, cast, { id: cast.id, generation: 0 });
}

/** Resolves one Primordial Stance pulse against the attunements live at its timestamp. */
function emitPrimordialStancePulse(
  context: ElementalistRuntime,
  at: number,
  captured: { readonly sourceId: Skill['id'] }
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
    emitElementalistDamage(context, {
      at,
      source: 'elementalist',
      sourceId,
      actorType: 'player',
      skillName: 'Primordial Stance',
      skillId: sourceId,
      coefficient: Number(strike.coefficient),
      skillWeapon: 'Unequipped',
      damageKind: 'field-tick'
    });

  for (const attunement of attunements) {
    const effect = requireEffect(primordialStanceProfile, 'condition', attunement);
    if (!effect) continue;

    emitElementalistCondition(context, {
      at,
      source: 'Primordial Stance',
      sourceId,
      skillName: 'Primordial Stance',
      condition: String(effect.condition),
      stacks: Number(effect.stacks),
      duration: Number(effect.duration)
    });
  }
}

/** Every pulse retains the cast targeting policy but reads the current hand pair. */
export function primordialStancePulse(runtime: ElementalistRuntime, data: unknown): void {
  const cast = data as RuntimeCast;
  withElementalistCast(runtime, cast, () =>
    emitPrimordialStancePulse(runtime, runtime.time, { sourceId: cast.skill.id })
  );
}
