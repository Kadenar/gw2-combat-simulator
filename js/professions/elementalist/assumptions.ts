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
    {
      key: "elementalSimulationProfile",
      label: "Elemental simulation",
      type: "select",
      defaultValue: "evtc",
      options: [
        { value: "evtc", label: "EVTC actor" },
        { value: "reference", label: "Reference packets" },
      ],
      section: "profession",
    },
    {
      key: "startingAttunementPreDwelled",
      label: "Starting attunement pre-dwelled",
      type: "boolean",
      defaultValue: true,
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
