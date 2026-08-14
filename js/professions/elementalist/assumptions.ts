import { createProfessionAssumptionControls } from "../../app/profession/assumptions.js";

export const ELEMENTALIST_ASSUMPTION_CONTROLS =
  createProfessionAssumptionControls([
    {
      key: "hitboxSize",
      label: "Target hitbox",
      type: "select",
      defaultValue: "small",
      options: [
        { value: "large", label: "Large" },
        { value: "small", label: "Small" },
      ],
      section: "target",
    },
    {
      key: "elementalSimulationProfile",
      label: "Elemental behavior",
      type: "select",
      defaultValue: "evtc",
      options: [
        { value: "evtc", label: "Native summon AI" },
        { value: "reference", label: "Fixed reference packets" },
      ],
      section: "profession",
    },
    {
      key: "glyphBoonedElementals",
      label: "Reference elemental booned",
      type: "boolean",
      defaultValue: false,
      section: "profession",
    },
  ]);
