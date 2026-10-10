import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Preserve the accepted blight-consumed boundary and its original reward order. */
export const harbingerBlightConsumed = defineTriggerPoint<{
  readonly cast: RuntimeCast<NecromancerSkill>;
  readonly at: number;
  readonly activationId: string;
  readonly consumed: number;
}>('necromancer.blight-consumed', [TRAIT.CASCADING_CORRUPTION]);

/** Preserve the accepted elixir-launched boundary and its original reward order. */
export const harbingerElixirLaunched = defineTriggerPoint<{
  readonly cast: RuntimeCast<NecromancerSkill>;
  readonly at: number;
  readonly activationId: string;
}>('necromancer.elixir-launched', [TRAIT.BOLSTERING_BREW]);

/** Preserve the accepted harbinger-shroud-entered boundary and its original reward order. */
export const harbingerShroudEntered = defineTriggerPoint<{ readonly skill: NecromancerSkill; readonly at: number }>(
  'necromancer.harbinger-shroud-entered',
  [TRAIT.CORRUPTED_TALENT, TRAIT.DEATHLY_HASTE, TRAIT.IMPLACABLE_FOE]
);

/** Preserve the accepted harbinger-strike boundary and its original reward order. */
export const harbingerStrike = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'necromancer.harbinger-strike',
  [TRAIT.DOOM_APPROACHES, TRAIT.SEPTIC_CORRUPTION]
);
