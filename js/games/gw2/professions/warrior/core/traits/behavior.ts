import { criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  armsCriticalRewards,
  burstPrecisionHit,
  triggerOpportunist
} from '#gw2/professions/warrior/core/traits/arms.js';
import { cullTheWeakBurst, mercilessHammerControl } from '#gw2/professions/warrior/core/traits/defense.js';
import { axeMasteryCritical, versatileRageSwap } from '#gw2/professions/warrior/core/traits/discipline.js';
import {
  berserkersPowerBurst,
  buildingMomentumBurst,
  forcefulGreatswordCritical
} from '#gw2/professions/warrior/core/traits/strength.js';
import { resetSoldierFocus, soldierFocusBurst } from '#gw2/professions/warrior/core/traits/tactics.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
/** Dispatch cross-line reactions in gameplay order; trait modules own their complete behavior. */

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/** Control events trigger Arms and Defense rewards; derived conditions reenter the common queue. */
export function controlTraits(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player') return;
  triggerOpportunist(runtime, event);
  mercilessHammerControl(runtime);
}

/** The first surviving burst strike claims its activation once, even when earlier packets missed or traveled. */
export function firstBurstHit(runtime: WarriorRuntime, event: Gw2ResolverEvent): boolean {
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
  if (!skill?.burst || event.activationId == null) return false;
  const state = runtime.profession.core;
  const key = event.activationId;
  if (state.burstHitActivations[key]) return false;
  state.burstHitActivations[key] = true;

  cullTheWeakBurst(runtime, event);
  burstPrecisionHit(runtime, event);

  buildingMomentumBurst(runtime);
  soldierFocusBurst(runtime, event);

  // Dragon Slash owns its charge-converted reward at completion rather than first impact.
  berserkersPowerBurst(runtime, event, skill);
  return true;
}

/** Every critical consumer uses the same resolved hit fact; only independent trait chances draw additional rolls. */
export function criticalTraits(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  hit: Gw2HitResolutionContext,
  firstBurst: boolean
): void {
  const opportunity = criticalOpportunity(
    hit.critEligible ? hit.critical.chance : 0,
    hit.critical.didCrit,
    Math.max(1, event.hits ?? 1)
  );
  const criticals = opportunity.sampledCriticals;

  armsCriticalRewards(runtime, event, opportunity, firstBurst);

  axeMasteryCritical(runtime, event, criticals);

  forcefulGreatswordCritical(runtime, event, opportunity);
}

/** The shared swap commits its destination first; Core then resets Focus and grants adrenaline. */
export function weaponSwapTraits(runtime: WarriorRuntime): void {
  resetSoldierFocus(runtime);
  versatileRageSwap(runtime);
}
