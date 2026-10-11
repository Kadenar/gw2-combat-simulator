import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { improvisationShadowForceMultiplier } from '#gw2/professions/thief/core/traits/deadly-arts/steal.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { completeThiefSteal } from '#gw2/professions/thief/core/mechanics/steal.js';
import { stealAccepted } from '#gw2/professions/thief/core/mechanics/boundaries.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Siphon's force grant stays between steal traits and completion so sibling mechanics observe the same balance. */
export function completeSiphon(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  runtime.fireTrigger(stealAccepted, { cast });
  runtime.resourceController.grant('shadowForce', siphonShadowForceGain(runtime));
  completeThiefSteal(runtime, []);
}

/** Resolve Siphon's selected tuning without mutation: add Amplified Siphoning before multiplying by Improvisation. */
function siphonShadowForceGain(runtime: MechanicQueriesOf<ThiefRuntime>): number {
  const base = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'lifeForceGain');
  const amplified = hasTrait(runtime, TRAIT.AMPLIFIED_SIPHONING)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.AMPLIFIED_SIPHONING), 'resourceGain')
    : 0;
  return (base + amplified) * improvisationShadowForceMultiplier(runtime);
}
