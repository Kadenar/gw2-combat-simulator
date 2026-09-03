import { defineProfessionSpecializationState, professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { EngineerCoreState, EngineerSchedulerContext, HolosmithState } from '#gw2/professions/engineer/types.js';
import type { GuardianCoreState, GuardianFirebrandState } from '#gw2/professions/guardian/types.js';

import type { NecromancerCoreState, ScourgeState } from '#gw2/professions/necromancer/types.js';
import type {
  ConduitState,
  RenegadeState,
  RevenantCoreState,
  VindicatorState
} from '#gw2/professions/revenant/types.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { CatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { WeaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import type { MesmerCoreState } from '#gw2/professions/mesmer/state/types.js';
import type { MesmerVirtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/types.js';

type Assert<T extends true> = T;
type Owns<TState, TField extends PropertyKey> = TField extends keyof TState ? true : false;
type Rejects<TState, TField extends PropertyKey> = TField extends keyof TState ? false : true;

export type ProfessionModuleStateBoundaryAssertions = [
  Assert<Owns<ElementalistCoreState, 'primaryAttunement'>>,
  Assert<Rejects<WeaverState, 'primaryAttunement'>>,
  Assert<Owns<WeaverState, 'unravelUntil'>>,
  Assert<Rejects<ElementalistCoreState, 'unravelUntil'>>,
  Assert<Owns<CatalystState, 'energy'>>,
  Assert<Rejects<ElementalistCoreState, 'energy'>>,
  Assert<Owns<EngineerCoreState, 'activeKit'>>,
  Assert<Rejects<HolosmithState, 'activeKit'>>,
  Assert<Owns<HolosmithState, 'heat'>>,
  Assert<Rejects<EngineerCoreState, 'heat'>>,
  Assert<Owns<GuardianCoreState, 'availableFlips'>>,
  Assert<Rejects<GuardianFirebrandState, 'availableFlips'>>,
  Assert<Owns<GuardianFirebrandState, 'tomePages'>>,
  Assert<Rejects<GuardianCoreState, 'tomePages'>>,
  Assert<Owns<MesmerCoreState, 'clones'>>,
  Assert<Rejects<MesmerVirtuosoState, 'clones'>>,
  Assert<Owns<MesmerVirtuosoState, 'numericResource'>>,
  Assert<Rejects<MesmerCoreState, 'numericResource'>>,
  Assert<Owns<NecromancerCoreState, 'lifeForce'>>,
  Assert<Rejects<ScourgeState, 'lifeForce'>>,
  Assert<Owns<ScourgeState, 'shades'>>,
  Assert<Rejects<NecromancerCoreState, 'shades'>>,
  Assert<Owns<RevenantCoreState, 'activeLegendId'>>,
  Assert<Rejects<VindicatorState, 'activeLegendId'>>,
  Assert<Owns<VindicatorState, 'allianceSide'>>,
  Assert<Rejects<RevenantCoreState, 'allianceSide'>>,
  Assert<Owns<RenegadeState, 'soulcleaveNextAlliedProcAt'>>,
  Assert<Rejects<RevenantCoreState, 'soulcleaveNextAlliedProcAt'>>,
  Assert<Owns<ConduitState, 'upkeepAffinityNextAt'>>,
  Assert<Rejects<RevenantCoreState, 'upkeepAffinityNextAt'>>
];

declare const context: EngineerSchedulerContext;
declare const elementalistContext: ElementalistSchedulerContext;

professionCoreState(context).endurance;
holosmithState.from(context).heat;
mechanistState.from(context).mech;
professionCoreState(elementalistContext).primaryAttunement;
weaverState.from(elementalistContext).unravelUntil;
catalystState.from(elementalistContext).energy;

// @ts-expect-error Core does not own Weaver state.
professionCoreState(elementalistContext).unravelUntil;
// @ts-expect-error Weaver cannot access its Catalyst sibling.
weaverState.from(elementalistContext).energy;

// @ts-expect-error Core does not own Holosmith state.
professionCoreState(context).heat;
// @ts-expect-error Holosmith cannot access its Mechanist sibling.
holosmithState.from(context).mech;
// @ts-expect-error Mechanist cannot access its Holosmith sibling.
mechanistState.from(context).heat;
// @ts-expect-error A module state factory cannot return an array.
defineProfessionSpecializationState('ArrayState', () => []);
// @ts-expect-error A module state factory cannot return a primitive.
defineProfessionSpecializationState('PrimitiveState', () => 1);
