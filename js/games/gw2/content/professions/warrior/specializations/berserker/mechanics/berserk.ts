import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import { syncWarriorAdrenaline } from '#gw2/content/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import {
  warriorBalanceProfile,
  WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE
} from '#gw2/content/professions/warrior/core/profiles.js';
import type { WarriorSchedulerContext } from '#gw2/content/professions/warrior/types.js';
import { berserkerState } from '#gw2/content/professions/warrior/specializations/berserker/state.js';

export function advanceBerserker(context: WarriorSchedulerContext, target: number): void {
  const state = berserkerState.from(context);
  if (state.berserkActive && state.berserkUntil <= target) {
    state.berserkActive = false;
    state.berserkUntil = 0;
    const core = professionCoreState(context);
    // Restore the full three-bar adrenaline cap when berserk expires.
    core.maximumAdrenaline = Number(warriorBalanceProfile(context, CORE_PROFILE.resources)?.maximumStacks ?? 30);
    syncWarriorAdrenaline(context);
  }
}
