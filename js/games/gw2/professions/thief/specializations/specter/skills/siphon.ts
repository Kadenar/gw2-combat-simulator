import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { completeThiefSteal } from '#gw2/professions/thief/core/mechanics/steal.js';
import { emitThiefStealTraits } from '#gw2/professions/thief/core/traits/steal.js';
import { siphonShadowForceGain } from '#gw2/professions/thief/specializations/specter/traits/behavior.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Siphon's force grant stays between steal traits and completion so sibling mechanics observe the same balance. */
export function completeSiphon(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  emitThiefStealTraits(runtime, cast);
  runtime.resourceController.grant('shadowForce', siphonShadowForceGain(runtime));
  completeThiefSteal(runtime, []);
}
