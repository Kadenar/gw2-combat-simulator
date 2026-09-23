import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefCastContext, ThiefSkill } from '#gw2/professions/thief/types.js';

import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

export function updatePalmStrikeWindow(context: ThiefCastContext, skill: ThiefSkill): void {
  if (context.action?.cancelled === true) return;
  const flips = professionCoreState(context).availableFlips;
  if (skill.id === ID.FIST_FLURRY) {
    // Only a completed, on-target flurry opens the follow-up in both scheduling and the palette.
    if (context.action?.offTarget === true || castWasInterrupted(context)) return;
    const palmStrikeProfile = requireBalanceProfileFromContext(context, PROFILE.palmStrike);
    armSkillFlip(
      flips,
      ID.PALM_STRIKE,
      context.effectiveEnd,
      context.effectiveEnd + balanceProfileNumber(palmStrikeProfile, 'durationMultiplier')
    );
    emitThiefStateSnapshot(context, context.effectiveEnd, 'palm-strike-ready');
  } else if (skill.id === ID.PALM_STRIKE) {
    // Consuming Palm Strike closes the window immediately so it cannot be cast twice
    consumeSkillFlip(flips, ID.PALM_STRIKE);
    emitThiefStateSnapshot(context, context.effectiveEnd, 'palm-strike-used');
  }
}
