import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast as deny } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';
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
    runtime.time + balanceNumberFromContext(runtime, PROFILE.resources, 'duration')
  );
}

/** Accepted player and pet strikes advance cross-buffs before player-only ambush rewards. */
export const untamedStrike = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>('ranger.untamed-strike', [
  TRAIT.FEROCIOUS_SYMBIOSIS,
  TRAIT.LET_LOOSE
]);

/** Both toggles share fixed recharge; only an eligible transfer to Ranger claims a new ambush. */
function unleash(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>, rangerUnleashed: boolean): void {
  untamedState.from(runtime).rangerUnleashed = rangerUnleashed;
  const readyAt = cast.start + balanceNumberFromContext(runtime, PROFILE.resources, 'recharge');
  runtime.cooldownController.setReadyAt(ID.UNLEASH_RANGER, readyAt);
  runtime.cooldownController.setReadyAt(ID.UNLEASH_PET, readyAt);

  if (rangerUnleashed && runtime.procs.claim(PROFILE.resources, 'ranger.untamed.unleashedPower', runtime.time))
    grantAmbush(runtime);
}

/** Both unleash transitions and ambush consumption share the availability and grant owner. */
const unleashActions: NonNullable<RuntimeHooks<RangerRuntimeState, RangerSkill>['sideEffectHandlers']> = {
  'ranger.ambush-consume'(runtime) {
    untamedState.from(runtime).ambushReadyUntil = 0;
  },
  'ranger.unleash-ranger'(runtime, context) {
    if (context.kind === 'cast') unleash(runtime, context.cast, true);
  },
  'ranger.unleash-pet'(runtime, context) {
    if (context.kind === 'cast') unleash(runtime, context.cast, false);
  }
};

/** Accepted player and pet strikes notify the ordered trait listeners once through the unleash owner. */
function reactToUntamedStrike(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (
    // Only hitting strikes (coefficient > 0) advance trait state; misses and barrier hits are excluded.
    !(Number(event.coefficient) > 0) ||
    (!isPlayerStrike(event) && !isPetStrike(event))
  ) {
    return;
  }

  context.fireTrigger(untamedStrike, { event });
}

/** Unleash transitions, ambush availability, and the ordered strike trigger share one owner. */
export const untamedUnleashLifecycle = {
  availability: untamedCastAvailability,
  sideEffectHandlers: unleashActions,
  reactions: { 'damage.resolved': reactToUntamedStrike }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;
