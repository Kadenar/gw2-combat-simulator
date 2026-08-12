import {
  createProfessionAssumptionControls,
  STANDARD_POSITION_ASSUMPTION_CONTROLS,
} from "../../app/profession/assumptions.js";

const RANGER_POSITION_ASSUMPTION_CONTROLS =
  STANDARD_POSITION_ASSUMPTION_CONTROLS.filter(
    (control) =>
      !["playerHealthPercent", "targetDistance"].includes(control.key),
  );

export const RANGER_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  ...RANGER_POSITION_ASSUMPTION_CONTROLS,
  {
    key: "astralForceHealingEventsPerSecond",
    label: "Astral Force healing events/s",
    type: "number",
    defaultValue: 0,
    minimum: 0,
    maximum: 20,
    step: 0.1,
    specializations: ["Druid"],
  },
]);
