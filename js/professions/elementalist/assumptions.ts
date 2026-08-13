import { createProfessionAssumptionControls } from "../../app/profession/assumptions.js";

export const ELEMENTALIST_ASSUMPTION_CONTROLS =
  createProfessionAssumptionControls([
    {
      key: "hitboxSize",
      label: "Target hitbox",
      type: "select",
      defaultValue: "large",
      options: [
        { value: "large", label: "Large" },
        { value: "small", label: "Small" },
      ],
      section: "target",
    },
  ]);
