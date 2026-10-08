import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import {
  applyFluidStrikes,
  applyHardToCatch,
  applyUpperHand
} from '#gw2/professions/thief/core/traits/acrobatics/behavior.js';
import { applyLotusPoison, applyPanicStrikePoison } from '#gw2/professions/thief/core/traits/deadly-arts/poison.js';
import { applyAlliedLeechingVenoms } from '#gw2/professions/thief/core/traits/shadow-arts/leeching-venoms.js';
import { applyLeadAttacks } from '#gw2/professions/thief/core/traits/trickery/behavior.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Movement skills open Fluid Strikes' window and grant Hard to Catch's endurance. */
function movementTraits(runtime: ThiefRuntime): void {
  applyFluidStrikes(runtime);
  applyHardToCatch(runtime);
}

/** Completion-time trait state: dodge, initiative-spend, and movement traits. */
export function completeThiefCastTraits(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  committed: boolean
): void {
  if (!committed) return;
  if (cast.skill.id === SHARED_SKILL_IDS.DODGE) applyUpperHand(runtime);
  applyLeadAttacks(runtime, cast);
  if (cast.skill.movementSkill) movementTraits(runtime);
}

/** Applied conditions drive Lotus Poison, allied Leeching Venoms, Panic Strike, Cloaked in Shadow, then the skill bonus. */
export function reactThiefCoreCondition(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  const context = runtime;
  applyLotusPoison(context, application);
  applyAlliedLeechingVenoms(context, application);
  applyPanicStrikePoison(context, application);
}
