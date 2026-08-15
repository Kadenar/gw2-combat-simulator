import {
  defineProfessionSpecializationState,
  professionCoreState,
} from "../../js/platform/engine/profession.js";
import { holosmithState } from "../../js/professions/engineer/specializations/holosmith/state.js";
import { mechanistState } from "../../js/professions/engineer/specializations/mechanist/state.js";
import type {
  EngineerCoreState,
  EngineerSchedulerContext,
  HolosmithState,
} from "../../js/professions/engineer/types.js";
import type {
  GuardianCoreState,
  GuardianFirebrandState,
} from "../../js/professions/guardian/types.js";
import type {
  MesmerCoreState,
  MesmerVirtuosoState,
} from "../../js/professions/mesmer/types.js";
import type {
  NecromancerCoreState,
  ScourgeState,
} from "../../js/professions/necromancer/types.js";
import type {
  RevenantCoreState,
  VindicatorState,
} from "../../js/professions/revenant/types.js";

type Assert<T extends true> = T;
type Owns<TState, TField extends PropertyKey> = TField extends keyof TState
  ? true
  : false;
type Rejects<TState, TField extends PropertyKey> = TField extends keyof TState
  ? false
  : true;

export type ProfessionModuleStateBoundaryAssertions = [
  Assert<Owns<EngineerCoreState, "activeKit">>,
  Assert<Rejects<HolosmithState, "activeKit">>,
  Assert<Owns<HolosmithState, "heat">>,
  Assert<Rejects<EngineerCoreState, "heat">>,
  Assert<Owns<GuardianCoreState, "availableFlips">>,
  Assert<Rejects<GuardianFirebrandState, "availableFlips">>,
  Assert<Owns<GuardianFirebrandState, "tomePages">>,
  Assert<Rejects<GuardianCoreState, "tomePages">>,
  Assert<Owns<MesmerCoreState, "clones">>,
  Assert<Rejects<MesmerVirtuosoState, "clones">>,
  Assert<Owns<MesmerVirtuosoState, "numericResource">>,
  Assert<Rejects<MesmerCoreState, "numericResource">>,
  Assert<Owns<NecromancerCoreState, "lifeForce">>,
  Assert<Rejects<ScourgeState, "lifeForce">>,
  Assert<Owns<ScourgeState, "shades">>,
  Assert<Rejects<NecromancerCoreState, "shades">>,
  Assert<Owns<RevenantCoreState, "activeLegendId">>,
  Assert<Rejects<VindicatorState, "activeLegendId">>,
  Assert<Owns<VindicatorState, "allianceSide">>,
  Assert<Rejects<RevenantCoreState, "allianceSide">>,
];

declare const context: EngineerSchedulerContext;

professionCoreState(context).endurance;
holosmithState.from(context).heat;
mechanistState.from(context).mech;

// @ts-expect-error Core does not own Holosmith state.
professionCoreState(context).heat;
// @ts-expect-error Holosmith cannot access its Mechanist sibling.
holosmithState.from(context).mech;
// @ts-expect-error Mechanist cannot access its Holosmith sibling.
mechanistState.from(context).heat;
// @ts-expect-error A module state factory cannot return an array.
defineProfessionSpecializationState("ArrayState", () => []);
// @ts-expect-error A module state factory cannot return a primitive.
defineProfessionSpecializationState("PrimitiveState", () => 1);
