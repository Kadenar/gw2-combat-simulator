import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { resourceDepletionAt } from '#gw2/platform/combat/resources/clock.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { lockTransitionInput } from '#gw2/platform/execution/transition-lockouts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { setThiefKneeling } from '#gw2/professions/thief/core/mechanics/resources.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import type { ThiefConfig, ThiefSkill } from '#gw2/professions/thief/types.js';
import { EPSILON } from '#kernel/core/clock.js';

export const SHADOW_DEPLETED = 'thief.shadow-shroud-depleted';

/**
 * Every gain or rate change replaces the prior depletion wake; shroud exhaustion is detected on the same tick grid as
 * cooldowns so fractional drain is kept.
 */
function refreshShadowDepletion(runtime: ThiefRuntime): void {
  const state = specterState.from(runtime);
  runtime.cancelOwner({ id: SHADOW_DEPLETED, generation: state.shadowWakeGeneration });
  state.shadowWakeGeneration++;
  const at = gw2CooldownReadyAt(resourceDepletionAt(state.shadowClock));
  if (Number.isFinite(at))
    runtime.schedule(SHADOW_DEPLETED, at, null, { id: SHADOW_DEPLETED, generation: state.shadowWakeGeneration }, -10);
}

/** Specter supplies drain and capacity; the shared lifecycle advances and replaces the depletion deadline. */
export const shadowForce: ResourcePolicy<ThiefRuntime> = {
  kind: 'continuous',
  state: (runtime) => specterState.from(runtime).shadowClock,
  maximum: (runtime) =>
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks'),
  initial: (runtime) => (runtime.config as ThiefConfig).initialShadowForce ?? 0,
  recovery: (runtime) => {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
    return specterState.from(runtime).shadowShroudActive
      ? -balanceProfileNumber(profile, 'maximumStacks') * balanceProfileNumber(profile, 'lifeForceDrain')
      : 0;
  },
  depletion: { refresh: refreshShadowDepletion, stop: refreshShadowDepletion }
};

/** Shroud transitions block input for their recovery and publish the bar change like a weapon swap. */
export function setShadowShroud(
  runtime: ThiefRuntime,
  active: boolean,
  skill: { id: string | number; name: string }
): void {
  lockTransitionInput(runtime, active ? 'shroudEntryMs' : 'shroudExitMs', skill);
  // Entering shroud ends the rifle stance and its initiative bonus before the replacement bar becomes active.
  if (active && runtime.profession.core.kneeling) setThiefKneeling(runtime, false);
  specterState.from(runtime).shadowShroudActive = active;
  runtime.resourceController.refresh('shadowForce');
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'weapon_set',
      at: runtime.time,
      source: 'thief',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      weaponSet: runtime.activeWeaponSet,
      shroudSwap: true
    }
  });
}

/** The surviving depletion wake forces the shroud closed with the exit transition's input lockout. */
export function shadowDepleted(runtime: ThiefRuntime): void {
  const state = specterState.from(runtime);
  if (!state.shadowShroudActive) return;
  setShadowShroud(runtime, false, { id: SHADOW_DEPLETED, name: 'Exit Shadow Shroud' });
}

/** Shroud entry needs force; inside the shroud only its own bar is castable, and exit waits out its lockout. */
export function specterAvailability(runtime: MechanicQueriesOf<ThiefRuntime>, skill: ThiefSkill): AvailabilityResult {
  const state = specterState.from(runtime);
  if (skill.id === ID.ENTER_SHADOW_SHROUD) {
    if (state.shadowShroudActive) return denySkillCast(skill, 'thief.in-shroud', 'Shadow Shroud is already active.');
    if (runtime.resourceController.value('shadowForce') <= 0)
      return denySkillCast(skill, 'thief.shadow-force', 'requires shadow force.');
  }

  if (skill.id === ID.EXIT_SHADOW_SHROUD && !state.shadowShroudActive)
    return denySkillCast(skill, 'thief.not-in-shroud', 'Shadow Shroud is not active.');
  if (skill.id === ID.EXIT_SHADOW_SHROUD && state.shadowShroudExitReadyAt > runtime.time + EPSILON)
    return denySkillCast(
      skill,
      'thief.shroud-exit-lockout',
      'Shadow Shroud exit is not ready.',
      state.shadowShroudExitReadyAt
    );
  if (skill.shadowShroudSkill && !state.shadowShroudActive)
    return denySkillCast(skill, 'thief.not-in-shroud', 'enter Shadow Shroud first.');
  if (
    state.shadowShroudActive &&
    !skill.shadowShroudSkill &&
    (skill.type === 'Weapon' || ['Heal', 'Utility', 'Elite'].includes(skill.type || ''))
  )
    return denySkillCast(skill, 'thief.in-shroud', 'the Shadow Shroud bar replaces weapons and slot skills.');
  return { ready: true };
}
