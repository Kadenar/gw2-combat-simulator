import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { WARRIOR_SKILL_IDS as ID } from '../../data/ids.js';
import { syncWarriorAdrenaline } from '../../core/resources.js';
import { warriorBalanceProfile, WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '../../core/profiles.js';
import type { WarriorSchedulerContext } from '../../types.js';
import { berserkerState } from './state.js';

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
