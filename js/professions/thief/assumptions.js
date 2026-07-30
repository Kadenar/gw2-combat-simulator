import {
  createProfessionAssumptionControls,
  STANDARD_POSITION_ASSUMPTION_CONTROLS,
} from "../../app/profession/assumptions.js";
import { THIEF_SKILL_IDS as ID } from "./data/ids.js";

const THIEF_SHARED_ASSUMPTION_CONTROLS =
  STANDARD_POSITION_ASSUMPTION_CONTROLS.filter(control =>
    !["playerHealthPercent", "targetDistance"].includes(control.key));

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

export const THIEF_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  ...THIEF_SHARED_ASSUMPTION_CONTROLS,
  {
    key: "stolenSkillChoice",
    label: "Stolen skill",
    type: "select",
    defaultValue: "throw-gunk",
    specializations: ["Core", "Daredevil"],
    options: [
      {
        value: "throw-gunk",
        label: "Throw Gunk (raid golem)",
        skillId: ID.THROW_GUNK,
      },
      {
        value: "consume-plasma",
        label: "Consume Plasma",
        skillId: ID.CONSUME_PLASMA,
      },
      {
        value: "whirling-axe",
        label: "Whirling Axe",
        skillId: ID.WHIRLING_AXE,
      },
    ],
  },
  {
    key: "deadeyeStolenSkillChoice",
    label: "Deadeye stolen skill",
    type: "select",
    defaultValue: "steal-time",
    specializations: ["Deadeye"],
    options: [
      {
        value: "steal-time",
        label: "Steal Time (raid boss)",
        skillId: ID.STEAL_TIME,
      },
      {
        value: "steal-warmth",
        label: "Steal Warmth",
        skillId: ID.STEAL_WARMTH,
      },
      {
        value: "steal-resistance",
        label: "Steal Resistance",
        skillId: ID.STEAL_RESISTANCE,
      },
      {
        value: "steal-precision",
        label: "Steal Precision",
        skillId: ID.STEAL_PRECISION,
      },
      {
        value: "steal-health",
        label: "Steal Health",
        skillId: ID.STEAL_HEALTH,
      },
      {
        value: "steal-strength",
        label: "Steal Strength",
        skillId: ID.STEAL_STRENGTH,
      },
      {
        value: "steal-durability",
        label: "Steal Durability",
        skillId: ID.STEAL_DURABILITY,
      },
      {
        value: "steal-defenses",
        label: "Steal Defenses",
        skillId: ID.STEAL_DEFENSES,
      },
      {
        value: "steal-mobility",
        label: "Steal Mobility",
        skillId: ID.STEAL_MOBILITY,
      },
    ],
  },
  ...THIEF_ANTIQUARY_SELECTION_CONTROLS,
]);
