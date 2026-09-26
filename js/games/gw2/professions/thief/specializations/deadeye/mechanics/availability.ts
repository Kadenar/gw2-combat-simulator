import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';

/** The live runtime and palette supply their flip deadlines directly so both enforce the same lifetime. */
export function deadeyeCastAvailability(
  flips: ThiefCoreState['availableFlips'] | undefined,
  skill: ThiefSkill,
  at: number
): AvailabilityResult {
  if (skill.id === ID.SHADOW_SWAP) {
    // Shadow Swap is a flip skill that only appears after Shadow Flare lands; block it directly rather than relying on the flip expiry in weapon-state.ts
    if (!skillFlipReady(flips?.[ID.SHADOW_SWAP], at)) {
      return {
        ready: false,
        retryAt: null,
        code: 'thief.shadow-flare',
        reason: 'Shadow Swap is unavailable — cast Shadow Flare first.'
      };
    }
  }

  if (!skill.stealthAttack) return { ready: true };
  // Non-malicious stealth attacks (Backstab, Death's Judgment) are replaced by their malicious versions on Deadeye
  if (skill.malicious) return { ready: true };
  return {
    ready: false,
    retryAt: null,
    code: 'thief.malicious-replacement',
    reason: `${skill.name} is unavailable — the malicious version replaces it.`
  };
}
