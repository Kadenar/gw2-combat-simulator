import {
  createProfessionAssumptionControls,
  STANDARD_POSITION_ASSUMPTION_CONTROLS,
} from "../../app/profession-assumptions.js";

export const THIEF_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  ...STANDARD_POSITION_ASSUMPTION_CONTROLS,
  {
    key: "stolenSkillChoice",
    label: "Stolen skill",
    type: "select",
    defaultValue: "throw-gunk",
    options: [
      { value: "throw-gunk", label: "Throw Gunk (raid golem)" },
      { value: "consume-plasma", label: "Consume Plasma" },
      { value: "whirling-axe", label: "Whirling Axe" },
    ],
  },
  {
    key: "markedTargetChoice",
    label: "Marked target",
    type: "select",
    defaultValue: "primary-target",
    options: [
      { value: "primary-target", label: "Primary target" },
      { value: "unmarked", label: "No marked target" },
    ],
  },
  {
    key: "artifactDrawSequence",
    label: "Artifact draw order",
    type: "select",
    defaultValue: "balanced",
    options: [
      { value: "balanced", label: "Balanced deterministic order" },
      { value: "reverse", label: "Reverse deterministic order" },
    ],
  },
  {
    key: "doubleEdgeOutcomeSequence",
    label: "Double Edge outcomes",
    type: "select",
    defaultValue: "alternate",
    options: [
      { value: "alternate", label: "Success, then backfire" },
      { value: "success", label: "Always succeed" },
      { value: "backfire", label: "Always backfire" },
    ],
  },
]);
