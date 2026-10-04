import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import type { WarriorResourcePolicy } from '#gw2/professions/warrior/core/mechanics/resource-policy.js';
/** The selected paragon owns its burst cost policy while sharing Core's adrenaline pool operations. */
export const paragonResourcePolicy: WarriorResourcePolicy = {
  ...coreAdrenalinePolicy,
  burstSpend: (runtime, skill) => Math.min(runtime.profession.core.adrenaline, skill.adrenalineCost ?? 0)
};
