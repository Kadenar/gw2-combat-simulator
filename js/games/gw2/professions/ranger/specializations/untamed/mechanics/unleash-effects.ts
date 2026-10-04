import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { denySkillCast as deny } from '#gw2/platform/execution/availability.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export function untamedCastAvailability(
  context: MechanicQueriesOf<RangerRuntime>,
  skill: RangerSkill
): AvailabilityResult {
  const state = untamedState.from(context);
  if (skill.id === ID.UNLEASH_RANGER && state.rangerUnleashed) {
    return deny(skill, 'ranger.ranger-unleashed', 'the ranger is already unleashed.');
  }

  if (skill.id === ID.UNLEASH_PET && !state.rangerUnleashed) {
    return deny(skill, 'ranger.pet-unleashed', 'the pet is already unleashed.');
  }

  if (skill.unleashedPetSkill && state.rangerUnleashed) {
    return deny(skill, 'ranger.pet-not-unleashed', 'Unleash Pet first.');
  }

  // Natural pet commands are replaced by the unleashed pet bar while the pet holds unleash.
  if (skill.petSkill && !state.rangerUnleashed) {
    return deny(skill, 'ranger.not-unleashed', 'Unleash Ranger first.');
  }

  if (skill.unleashedAmbushSkill) {
    if (!state.rangerUnleashed) {
      return deny(skill, 'ranger.not-unleashed', 'Unleash Ranger first.');
    }

    // ambushReadyUntil is a deadline, not a cooldown: the window closes when time reaches it.
    if (context.time >= state.ambushReadyUntil) {
      return deny(skill, 'ranger.ambush-unavailable', 'unleash to make an ambush available.');
    }
  }

  return { ready: true };
}

/** Each ambush window expires only its own grant, preserving the independent grant cooldown. */
export function grantAmbush(runtime: RangerRuntime): void {
  const state = untamedState.from(runtime);
  state.ambushReadyUntil = canonicalTime(
    runtime.time +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'durationMultiplier')
  );
}
