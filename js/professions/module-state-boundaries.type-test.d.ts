import type { EngineerCoreState, HolosmithState } from "./engineer/types.js";
import type {
  GuardianCoreState,
  GuardianFirebrandState,
} from "./guardian/types.js";
import type {
  MesmerCoreState,
  MesmerVirtuosoState,
} from "./mesmer/types.js";
import type {
  NecromancerCoreState,
  ScourgeState,
} from "./necromancer/types.js";
import type {
  RevenantCoreState,
  VindicatorState,
} from "./revenant/types.js";

type Assert<T extends true> = T;
type Owns<TState, TField extends PropertyKey> =
  TField extends keyof TState ? true : false;
type Rejects<TState, TField extends PropertyKey> =
  TField extends keyof TState ? false : true;

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
