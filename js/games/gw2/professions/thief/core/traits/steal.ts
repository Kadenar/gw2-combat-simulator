import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import {
  applyEvenTheOdds,
  applyMug,
  applySerpentsTouch
} from '#gw2/professions/thief/core/traits/deadly-arts/steal.js';
import { applyHiddenThief } from '#gw2/professions/thief/core/traits/shadow-arts/stealth.js';
import {
  applyBountifulTheft,
  applyDeadlyAmbush,
  applySleightOfHand,
  applyThrillOfTheCrime
} from '#gw2/professions/thief/core/traits/trickery/steal.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Selected on-steal traits apply in the cross-line order shared by every steal variant. */
export function emitThiefStealTraits(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  applySerpentsTouch(runtime, cast);
  applyMug(runtime, cast);
  applyEvenTheOdds(runtime, cast);
  applyDeadlyAmbush(runtime, cast);
  applyThrillOfTheCrime(runtime, cast);
  applyBountifulTheft(runtime, cast);
  applySleightOfHand(runtime, cast);
  applyHiddenThief(runtime, cast);
}
