import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  cloneStateFields,
  defineProfessionSpecializationState,
  professionCoreState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { CatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { WeaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistPlanningState, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import type { EngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import type { HolosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { EngineerPlanningState, EngineerRuntime } from '#gw2/professions/engineer/types.js';
import { projectGuardianPlanningState, type GuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import type { GuardianFirebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianPlanningState } from '#gw2/professions/guardian/types.js';
import type { MesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import type { MesmerTroubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerVirtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import type { MesmerPlanningState } from '#gw2/professions/mesmer/types.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { ScourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import type { NecromancerPlanningState } from '#gw2/professions/necromancer/types.js';
import type { GaleshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import type { RangerPlanningState } from '#gw2/professions/ranger/types.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import type { ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { VindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import type { RevenantPlanningState } from '#gw2/professions/revenant/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import type { DeadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { ThiefPlanningState } from '#gw2/professions/thief/types.js';
import type { WarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import type { BladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { ParagonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { WarriorPlanningState } from '#gw2/professions/warrior/types.js';

type Assert<T extends true> = T;
type Owns<TState, TField extends PropertyKey> = TField extends keyof TState ? true : false;
type Rejects<TState, TField extends PropertyKey> = TField extends keyof TState ? false : true;

export type ProfessionModuleStateBoundaryAssertions = [
  // Endurance capacity and observation time belong to the clock, never sibling scalar fields.
  Assert<WarriorCoreState['endurance'] extends ResourceClock ? true : false>,
  Assert<ElementalistCoreState['endurance'] extends ResourceClock ? true : false>,
  Assert<EngineerCoreState['endurance'] extends ResourceClock ? true : false>,
  Assert<GuardianCoreState['endurance'] extends ResourceClock ? true : false>,
  Assert<NecromancerCoreState['endurance'] extends ResourceClock ? true : false>,
  Assert<RevenantCoreState['endurance'] extends ResourceClock ? true : false>,
  Assert<MesmerTroubadourState['endurance'] extends ResourceClock ? true : false>,
  Assert<Rejects<WarriorCoreState, 'enduranceUpdatedAt'>>,
  Assert<Rejects<WarriorCoreState, 'maximumEndurance'>>,
  Assert<DeadeyeState['malice'] extends ResourceClock ? true : false>,
  Assert<Rejects<DeadeyeState, 'maximumMalice'>>,
  Assert<EvokerState['familiarCharges'] extends ResourceClock ? true : false>,
  Assert<EvokerState['empoweredCharges'] extends ResourceClock ? true : false>,
  Assert<Rejects<EvokerState, 'charges'>>,
  Assert<Rejects<EvokerState, 'maximumCharges'>>,
  Assert<Rejects<EvokerState, 'empowered'>>,
  Assert<WarriorCoreState['adrenaline'] extends ResourceClock ? true : false>,
  Assert<BladeswornState['flow'] extends ResourceClock ? true : false>,
  Assert<BladeswornState['dragonCharges'] extends ResourceClock ? true : false>,
  Assert<Rejects<WarriorCoreState, 'maximumAdrenaline'>>,
  Assert<Rejects<BladeswornState, 'maximumFlow'>>,
  Assert<GaleshotState['windForce'] extends ResourceClock ? true : false>,
  Assert<ParagonState['motivation'] extends ResourceClock ? true : false>,
  Assert<Rejects<ParagonState, 'maximumMotivation'>>,
  Assert<Owns<ElementalistCoreState, 'primaryAttunement'>>,
  Assert<Rejects<WeaverState, 'primaryAttunement'>>,
  Assert<Owns<WeaverState, 'unravelUntil'>>,
  Assert<Rejects<ElementalistCoreState, 'unravelUntil'>>,
  Assert<Owns<CatalystState, 'catalystEnergy'>>,
  Assert<Rejects<ElementalistCoreState, 'catalystEnergy'>>,
  Assert<Rejects<CatalystState, 'energy'>>,
  Assert<Rejects<CatalystState, 'maximumEnergy'>>,
  Assert<Owns<EngineerCoreState, 'activeKit'>>,
  Assert<Rejects<HolosmithState, 'activeKit'>>,
  Assert<HolosmithState['heat'] extends ResourceClock ? true : false>,
  Assert<Rejects<HolosmithState, 'maximumHeat'>>,
  Assert<Rejects<EngineerCoreState, 'heat'>>,
  Assert<Owns<GuardianCoreState, 'availableFlips'>>,
  Assert<Rejects<GuardianFirebrandState, 'availableFlips'>>,
  Assert<Owns<GuardianFirebrandState, 'tomePages'>>,
  Assert<Rejects<GuardianCoreState, 'tomePages'>>,
  Assert<Owns<MesmerCoreState, 'clones'>>,
  Assert<Rejects<MesmerVirtuosoState, 'clones'>>,
  Assert<MesmerVirtuosoState['blades'] extends ResourceClock ? true : false>,
  Assert<MesmerTroubadourState['notes'] extends ResourceClock ? true : false>,
  Assert<Rejects<MesmerVirtuosoState, 'numericResource'>>,
  Assert<Rejects<MesmerTroubadourState, 'numericResource'>>,
  Assert<Rejects<MesmerCoreState, 'numericResource'>>,
  Assert<Owns<NecromancerCoreState, 'lifeForce'>>,
  Assert<Rejects<ScourgeState, 'lifeForce'>>,
  Assert<Owns<ScourgeState, 'shades'>>,
  Assert<Rejects<NecromancerCoreState, 'shades'>>,
  Assert<Owns<RevenantCoreState, 'activeLegendId'>>,
  Assert<Rejects<VindicatorState, 'activeLegendId'>>,
  Assert<Owns<VindicatorState, 'reaversCurseUntil'>>,
  Assert<Rejects<RevenantCoreState, 'reaversCurseUntil'>>,
  // Proc deadlines now belong to the runtime registry, not either profession slice.
  Assert<Rejects<RenegadeState, 'soulcleaveReadyAt'>>,
  Assert<Rejects<RevenantCoreState, 'soulcleaveReadyAt'>>,
  Assert<Owns<ConduitState, 'affinity'>>,
  Assert<ConduitState['affinity'] extends ResourceClock ? true : false>,
  Assert<Rejects<ConduitState, 'affinityMaximum'>>,
  Assert<Rejects<RevenantCoreState, 'affinity'>>
];

declare const context: EngineerRuntime;
declare const elementalistContext: ElementalistRuntime;

professionCoreState(context).endurance;
holosmithState.from(context).heat;
mechanistState.from(context).mech;
professionCoreState(elementalistContext).primaryAttunement;
weaverState.from(elementalistContext).unravelUntil;
catalystState.from(elementalistContext).catalystEnergy.value;

// @ts-expect-error Core does not own Weaver state.
professionCoreState(elementalistContext).unravelUntil;
// @ts-expect-error Weaver cannot access its Catalyst sibling.
weaverState.from(elementalistContext).catalystEnergy;

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

// Selected runtime fields retain precise types and reject misspelled owner properties.
declare const firebrandState: GuardianFirebrandState;
const pages = cloneStateFields(firebrandState, ['tomePages']);
pages.tomePages.value.toFixed();
// @ts-expect-error Unknown runtime fields cannot enter a public projection.
cloneStateFields(firebrandState, ['tomePagez']);

// Public projection types preserve selected fields without claiming private runtime counters exist.
declare const planningInput: Gw2PlanningStateInput;
const guardianProjection = projectGuardianPlanningState(planningInput);
guardianProjection[STATE.RESOLUTION_UNTIL].toFixed();
guardianProjection[STATE.SYMBOLIC_AVENGER_EXPIRATIONS].map((expiresAt) => expiresAt.toFixed());
// @ts-expect-error Justice's private hit counter is absent from the public projection.
guardianProjection.justiceHitCount.toFixed();
// @ts-expect-error Core's private virtue readiness is not part of its public projection.
guardianProjection.virtueReadyAt.justice;

// Every family's presentation vocabulary is inferred from projectors and contains only registered IDs.
type PlanningStateId = (typeof STATE)[keyof typeof STATE];

export type PublicPlanningIdentityAssertions = [
  Assert<keyof ElementalistPlanningState extends PlanningStateId ? true : false>,
  Assert<keyof EngineerPlanningState extends PlanningStateId ? true : false>,
  Assert<keyof GuardianPlanningState extends PlanningStateId ? true : false>,
  Assert<keyof MesmerPlanningState extends PlanningStateId ? true : false>,
  Assert<keyof NecromancerPlanningState extends PlanningStateId ? true : false>,
  Assert<keyof RangerPlanningState extends PlanningStateId ? true : false>,
  Assert<keyof RevenantPlanningState extends PlanningStateId ? true : false>,
  Assert<keyof ThiefPlanningState extends PlanningStateId ? true : false>,
  Assert<keyof WarriorPlanningState extends PlanningStateId ? true : false>,
  Assert<Rejects<GuardianPlanningState, 'resolutionUntil'>>,
  Assert<Owns<GuardianPlanningState, typeof STATE.RESOLUTION_UNTIL>>,
  Assert<Rejects<ThiefPlanningState, 'initiative'>>,
  Assert<Owns<ThiefPlanningState, typeof STATE.INITIATIVE>>
];
