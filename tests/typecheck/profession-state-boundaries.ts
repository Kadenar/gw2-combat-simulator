import {
  defineProfessionSpecializationState,
  professionCoreState,
} from "../../js/platform/engine/profession.js";
import { holosmithState } from "../../js/professions/engineer/specializations/holosmith/state.js";
import { mechanistState } from "../../js/professions/engineer/specializations/mechanist/state.js";
import type { EngineerSchedulerContext } from "../../js/professions/engineer/types.js";

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
