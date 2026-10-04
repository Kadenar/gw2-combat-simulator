import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorResourcePolicy } from '#gw2/professions/warrior/core/mechanics/resource-policy.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
/** The selected berserker owns its burst cost policy while sharing Core's adrenaline pool operations. */
export const berserkerResourcePolicy: WarriorResourcePolicy = {
  ...coreAdrenalinePolicy,
  burstSpend: (runtime, skill) =>
    skill.primalBurst
      ? Math.min(runtime.profession.core.adrenaline, skill.adrenalineCost ?? 0)
      : coreAdrenalinePolicy.burstSpend(runtime, skill),
  availability(runtime, skill, command) {
    // Active Berserk owns its re-entry deadline; its temporary cap cannot make that wait permanently unaffordable.
    if (skill.id === ID.BERSERK && berserkerState.from(runtime).berserkActive) return { ready: true };
    return coreAdrenalinePolicy.availability(runtime, skill, command);
  }
};
