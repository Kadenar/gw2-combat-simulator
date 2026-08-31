import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { snapshotThiefState } from '#gw2/content/professions/thief/core/state.js';
import type { ThiefCastContext, ThiefSkill } from '#gw2/content/professions/thief/types.js';
import { daredevilState } from '#gw2/content/professions/thief/specializations/daredevil/state.js';

import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/specializations/daredevil/profiles.js';

export function updatePalmStrikeWindow(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = daredevilState.from(context);
  if (skill.id === ID.FIST_FLURRY) {
    // +5 s gives comfortable headroom past the 3 s in-game window to absorb cast-time variance
    state.palmStrikeUntil =
      context.effectiveEnd + Number(balanceProfileFromContext(context, PROFILE.palmStrike)?.durationMultiplier || 5);
    emitStateSnapshot(
      context,
      'thief',
      context.effectiveEnd,
      'palm-strike-ready',
      snapshotThiefState(context.state.profession)
    );
  } else if (skill.id === ID.PALM_STRIKE) {
    // Consuming Palm Strike closes the window immediately so it cannot be cast twice
    state.palmStrikeUntil = 0;
    emitStateSnapshot(
      context,
      'thief',
      context.effectiveEnd,
      'palm-strike-used',
      snapshotThiefState(context.state.profession)
    );
  }
}
