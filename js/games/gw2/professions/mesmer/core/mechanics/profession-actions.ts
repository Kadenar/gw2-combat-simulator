/** Declare ordered shatter and profession-action trait notifications independently of their execution owner. */
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { MesmerShatter, MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Preserve the accepted shatter-resolved boundary and its existing reward order. */
export const mesmerShatterResolved = defineTriggerPoint<{
  readonly shatter: MesmerShatter | undefined;
  readonly resolution: MesmerShatterResolution;
}>('mesmer.shatter-resolved', [TRAIT.MAIM_THE_DISILLUSIONED, TRAIT.RENDING_SHATTER, TRAIT.ILLUSIONARY_MEMBRANE]);

/** Shared on-use rewards consume the captured shatter or instrument spend, never a summon replay. */
export const mesmerProfessionActionCommitted = defineTriggerPoint<{
  readonly slot: number;
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly spent: number;
  readonly delivery: EffectDelivery;
}>('mesmer.profession-action-committed', [TRAIT.ILLUSIONARY_DEFENSE]);

/** Specialization rewards follow Core shatter materialization and its marker, using the captured committed spend. */
export const mesmerShatterCompleted = defineTriggerPoint<{
  readonly resolution: MesmerShatterResolution;
}>('mesmer.shatter-completed', [
  TRAIT.STRETCHED_TIME,
  TRAIT.SEIZE_THE_MOMENT,
  TRAIT.ILLUSIONARY_REVERSION,
  TRAIT.DEADLY_BLADES,
  TRAIT.INFINITE_FORGE,
  TRAIT.RIDDLE_OF_SAND,
  TRAIT.NOMADS_ENDURANCE,
  TRAIT.PHANTOM_PAIN,
  TRAIT.DESERT_DISTORTION,
  TRAIT.DUNE_CLOAK
]);
