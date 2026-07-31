import {
  createProfessionAssumptionControls,
} from "../../../../app/profession/assumptions.js";

export const THIEF_ANTIQUARY_SELECTION_CONTROLS = Object.freeze([
  {
    key: "artifactDrawSequence",
    label: "Artifact draw order",
    type: "select",
    defaultValue: "balanced",
    section: "Antiquary",
    specializations: ["Antiquary"],
    options: [
      { value: "balanced", label: "Balanced deterministic order" },
      { value: "reverse", label: "Reverse deterministic order" },
      { value: "choose", label: "Choose from all artifacts" },
    ],
  },
  {
    key: "doubleEdgeOutcomeSequence",
    label: "Double Edge outcomes",
    type: "select",
    defaultValue: "alternate",
    section: "Antiquary",
    specializations: ["Antiquary"],
    options: [
      { value: "alternate", label: "Success, then backfire" },
      { value: "success", label: "Always succeed" },
      { value: "backfire", label: "Always backfire" },
    ],
  },
  {
    key: "forgedSurferBombsHit",
    label: "Forged Surfer bombs hit",
    type: "select",
    defaultValue: "5",
    section: "Antiquary",
    specializations: ["Antiquary"],
    options: [
      { value: "1", label: "1 bomb" },
      { value: "2", label: "2 bombs" },
      { value: "3", label: "3 bombs" },
      { value: "4", label: "4 bombs" },
      { value: "5", label: "5 bombs (maximum)" },
    ],
  },
]);

export const THIEF_ANTIQUARY_ASSUMPTION_CONTROLS =
  createProfessionAssumptionControls(THIEF_ANTIQUARY_SELECTION_CONTROLS);
