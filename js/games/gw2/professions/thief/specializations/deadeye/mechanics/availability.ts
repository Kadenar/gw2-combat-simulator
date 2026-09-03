import type { AvailabilityResult } from '#gw2/platform/engine/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

interface DeadeyeAvailabilityContext {
  readonly state?: { readonly profession?: unknown };
  readonly start?: number;
}

export function deadeyeCastAvailability(context: DeadeyeAvailabilityContext, skill: ThiefSkill): AvailabilityResult {
  if (skill.id === ID.SHADOW_SWAP) {
    // Shadow Swap is a flip skill that only appears after Shadow Flare lands; block it directly rather than relying on the flip expiry in weapon-state.ts
    const profession = context.state?.profession as {
      readonly core?: { readonly availableFlips?: Record<string, number> };
      readonly availableFlips?: Record<string, number>;
    };
    // Context may carry a flat ThiefState (UI path) or a structured ThiefRuntimeState (scheduler path)
    const flips = profession?.core?.availableFlips || profession?.availableFlips;
    const expiresAt = Number(flips?.[String(ID.SHADOW_SWAP)] || 0);
    if (expiresAt <= Number(context.start || 0)) {
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
