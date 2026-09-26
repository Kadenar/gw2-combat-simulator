import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import type { ThiefRuntimeState } from '#gw2/professions/thief/types.js';
import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import { expireCharges } from '#gw2/platform/combat/resources/charges.js';
import { composePublicStateProjections, projectPublicProfessionState } from '#gw2/platform/engine/profession/state.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { THIEF_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/core/state.js';
import { ANTIQUARY_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { DAREDEVIL_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/specializations/daredevil/state.js';
import { DEADEYE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { SPECTER_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/specializations/specter/state.js';
import { ANTIQUARY_THIEVES_GUILD_SUMMON } from '#gw2/professions/thief/specializations/antiquary/mechanics/thieves-guild.js';
import { DAREDEVIL_THIEVES_GUILD_SUMMON } from '#gw2/professions/thief/specializations/daredevil/mechanics/thieves-guild.js';
import { DEADEYE_THIEVES_GUILD_SUMMON } from '#gw2/professions/thief/specializations/deadeye/mechanics/thieves-guild.js';
import { SPECTER_THIEVES_GUILD_SUMMON } from '#gw2/professions/thief/specializations/specter/mechanics/thieves-guild.js';
import type { ThiefState, ThiefSummonDefinition } from '#gw2/professions/thief/types.js';

// Compose public metadata once; runtime initialization and ownership stay with each slice.
const THIEF_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  THIEF_CORE_PUBLIC_STATE_PROJECTION,
  DAREDEVIL_PUBLIC_STATE_PROJECTION,
  DEADEYE_PUBLIC_STATE_PROJECTION,
  SPECTER_PUBLIC_STATE_PROJECTION,
  ANTIQUARY_PUBLIC_STATE_PROJECTION
]);

export const THIEF_PUBLIC_END_STATE_KEYS = THIEF_PUBLIC_STATE_PROJECTION.keys;

/** Publish detached clocks and grants so presentation cannot mutate live resource state. */
export function projectThiefPlanningState({
  profession,
  time
}: Gw2PlanningStateInput<ThiefRuntimeState>): Record<string, unknown> {
  const state = snapshotProfessionState<ThiefState>(profession);
  // Expire the detached grant for display without changing the observed state.
  if (state.mistburn) expireCharges(state.mistburn, time);
  state.combatHighExpirations = purgeExpiredStacks(state.combatHighExpirations || [], time);
  // Publish the surviving uses themselves, preserving their FIFO order on the detached snapshot.
  state.holoUtilityCooldownReductionExpirations = purgeExpiredStacks(
    state.holoUtilityCooldownReductionExpirations || [],
    time
  );
  return projectPublicProfessionState(state, THIEF_PUBLIC_END_STATE_KEYS, THIEF_PUBLIC_STATE_PROJECTION.defaults);
}

const SPECIALIZATION_THIEVES_GUILD_SUMMON: Readonly<Record<string, ThiefSummonDefinition>> = Object.freeze({
  Antiquary: ANTIQUARY_THIEVES_GUILD_SUMMON,
  Daredevil: DAREDEVIL_THIEVES_GUILD_SUMMON,
  Deadeye: DEADEYE_THIEVES_GUILD_SUMMON,
  Specter: SPECTER_THIEVES_GUILD_SUMMON
});

// Family-level dispatch selects a specialization-owned summon without leaking elite definitions into Core.
export function thiefSpecializationGuildSummon(specialization: string): ThiefSummonDefinition | null {
  return SPECIALIZATION_THIEVES_GUILD_SUMMON[specialization] || null;
}
