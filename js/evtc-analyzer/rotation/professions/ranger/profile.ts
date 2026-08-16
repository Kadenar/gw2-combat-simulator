import type { ProfessionProfileSource } from "../../profiles.js";
import { DRUID_BUFF_TRANSITIONS } from "./druid.js";
import { SOULBEAST_BUFF_TRANSITIONS } from "./soulbeast.js";
import { UNTAMED_BUFF_TRANSITIONS } from "./untamed.js";

export const rangerProfileSource: ProfessionProfileSource = {
  id: "ranger",
  name: "Ranger",
  specializations: {
    core: "Core",
    druid: "Druid",
    soulbeast: "Soulbeast",
    untamed: "Untamed",
    galeshot: "Galeshot",
  },
  buffTransitionsBySpecialization: {
    druid: DRUID_BUFF_TRANSITIONS,
    soulbeast: SOULBEAST_BUFF_TRANSITIONS,
    untamed: UNTAMED_BUFF_TRANSITIONS,
  },
};
