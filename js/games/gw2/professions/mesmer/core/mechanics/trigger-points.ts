import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Accepted control settles Chaotic Interruption before Ineptitude can create nested Confusion. */
export const mesmerControlAccepted = defineTriggerPoint<{ readonly event: SimulationEvent }>(
  'mesmer.control-accepted',
  [TRAIT.CHAOTIC_INTERRUPTION, TRAIT.INEPTITUDE]
);

/** The resolved critical outcome reaches Master Fencer before summon-owned Sharper Images. */
export const mesmerCritical = defineTriggerPoint<{ readonly event: SimulationEvent; readonly chance: number }>(
  'mesmer.critical',
  [TRAIT.MASTER_FENCER, TRAIT.SHARPER_IMAGES]
);

/** Sword stacks follow Core critical rewards and precede specialization strike reactions. */
export const mesmerStrikeResolved = defineTriggerPoint<{ readonly event: SimulationEvent }>('mesmer.strike-resolved', [
  TRAIT.FENCERS_FINESSE
]);

/** Native Burning can add The Pledge before Blindness recursively applies Ineptitude. */
export const mesmerConditionApplied = defineTriggerPoint<{ readonly event: SimulationEvent }>(
  'mesmer.condition-applied',
  [TRAIT.THE_PLEDGE, TRAIT.INEPTITUDE]
);

/** Mirage completes cloak rewards before a successful evade can queue its Core clone reward. */
export const mesmerEvaded = defineTriggerPoint<{ readonly at: number }>('mesmer.evaded', [TRAIT.DECEPTIVE_EVASION]);

/** Completed healing skills settle their native work before Method of Madness schedules its storm. */
export const mesmerHealCompleted = defineTriggerPoint<{
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly delivery: EffectDelivery;
}>('mesmer.heal-completed', [TRAIT.METHOD_OF_MADNESS]);
