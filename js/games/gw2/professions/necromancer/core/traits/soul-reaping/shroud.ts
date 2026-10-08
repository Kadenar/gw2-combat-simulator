import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { emitNecromancerShroudTrait } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Emit Soul Reaping rewards at committed shroud entry and exit boundaries. */

/** Callers supply their trigger attribution; Core owns Soul Barbs selection and duration for every shroud variant. */
export function applySoulBarbs(
  runtime: NecromancerRuntime,
  attribution: Pick<EffectEventBase, 'source' | 'sourceId' | 'skillId' | 'skillName' | 'activationId'> = {
    source: 'Trait',
    sourceId: TRAIT.SOUL_BARBS
  }
): void {
  if (!hasTrait(runtime, TRAIT.SOUL_BARBS)) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      ...attribution,
      actorType: 'player',
      kind: 'necromancer-soul-barbs',
      stacks: 1,
      duration: balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_BARBS), 'duration')
    }
  });
}

/** Emits speed of shadows at the ordered post-entry boundary. */
export function enterSpeedOfShadows(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.SPEED_OF_SHADOWS);
}

/** Emits eternal life at the ordered post-entry boundary. */
export function enterEternalLife(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.ETERNAL_LIFE);
}
