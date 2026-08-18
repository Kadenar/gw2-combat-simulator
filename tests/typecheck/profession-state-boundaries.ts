import { defineProfessionSpecializationState, professionCoreState } from '../../js/platform/engine/profession.js';
import { holosmithState } from '../../js/professions/engineer/specializations/holosmith/state.js';
import { mechanistState } from '../../js/professions/engineer/specializations/mechanist/state.js';
import type {
  EngineerCoreState,
  EngineerSchedulerContext,
  HolosmithState
} from '../../js/professions/engineer/types.js';
import type { GuardianCoreState, GuardianFirebrandState } from '../../js/professions/guardian/types.js';
import type { MesmerCoreState, MesmerVirtuosoState } from '../../js/professions/mesmer/types.js';
import type { NecromancerCoreState, ScourgeState } from '../../js/professions/necromancer/types.js';
import type { RevenantCoreState, VindicatorState } from '../../js/professions/revenant/types.js';
import { weaverState } from '../../js/professions/elementalist/specializations/weaver/state.js';
import { catalystState } from '../../js/professions/elementalist/specializations/catalyst/state.js';
import type { CatalystState } from '../../js/professions/elementalist/specializations/catalyst/state.js';
import type { WeaverState } from '../../js/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistCoreState } from '../../js/professions/elementalist/core/state.js';
import type { ElementalistSchedulerContext } from '../../js/professions/elementalist/types.js';

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
  Assert<Rejects<RevenantCoreState, 'allianceSide'>>
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
