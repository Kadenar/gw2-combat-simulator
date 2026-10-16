/** Revenant live state and cost inputs expose only their declared fields. */
import type { InternalWork } from '#gw2/platform/simulation/work-contract.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { RevenantUpkeepState } from '#gw2/professions/revenant/core/state.js';
import { revenantRuntimeSpecializationState } from '#gw2/professions/revenant/core/state-queries.js';
import type { ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { VindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import type { RevenantEnergyCostInput, RevenantRuntimeState } from '#gw2/professions/revenant/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

export type RevenantRecordAssertions = [
  Assert<string extends keyof RevenantRuntimeState ? false : true>,
  Assert<string extends keyof RevenantEnergyCostInput ? false : true>,
  // Every live or preview upkeep must identify the activation that owns its scheduled work.
  Assert<RevenantUpkeepState extends { startsAt: number } ? true : false>
];

// Literal specialization requests retain exactly their owner's partial state, rather than the combined projection.
export type RevenantSpecializationQueryAssertions = [
  Assert<Equal<ReturnType<typeof revenantRuntimeSpecializationState<'Herald'>>, Partial<HeraldState>>>,
  Assert<Equal<ReturnType<typeof revenantRuntimeSpecializationState<'Renegade'>>, Partial<RenegadeState>>>,
  Assert<Equal<ReturnType<typeof revenantRuntimeSpecializationState<'Vindicator'>>, Partial<VindicatorState>>>,
  Assert<Equal<ReturnType<typeof revenantRuntimeSpecializationState<'Conduit'>>, Partial<ConduitState>>>
];

/** Inference rejects cross-specialization reads, Core fields, and unknown specialization names. */
export function revenantSpecializationQueryReads(context: Gw2ModifierContext): void {
  const herald = revenantRuntimeSpecializationState(context, 'Herald');
  const conduit = revenantRuntimeSpecializationState(context, 'Conduit');
  // @ts-expect-error Herald queries cannot read Conduit resources.
  herald.affinity;
  // @ts-expect-error Conduit queries cannot read Herald facet state.
  conduit.lingeringFacets;
  // @ts-expect-error Specialization queries do not include Core legend state.
  herald.activeLegendId;
  // @ts-expect-error Only specialization kinds declared by the runtime union are accepted.
  revenantRuntimeSpecializationState(context, 'Unknown');
}

declare const task: InternalWork<'fixture.task', object>;
// @ts-expect-error Tasks without a declared payload do not expose arbitrary fields.
task.payload?.eventOrder;
