import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import type { ThiefSkill } from "../../types.js";

interface DeadeyeAvailabilityContext {
  readonly state?: { readonly profession?: unknown };
  readonly start?: number;
}

export function deadeyeCastAvailability(
  context: DeadeyeAvailabilityContext,
  skill: ThiefSkill,
): AvailabilityResult {
  if (skill.id === ID.SHADOW_SWAP) {
    const profession = context.state?.profession as {
      readonly core?: { readonly availableFlips?: Record<string, number> };
      readonly availableFlips?: Record<string, number>;
    };
    const flips =
      profession?.core?.availableFlips || profession?.availableFlips;
    const expiresAt = Number(flips?.[String(ID.SHADOW_SWAP)] || 0);
    if (expiresAt <= Number(context.start || 0)) {
      return {
        ready: false,
        retryAt: null,
        code: "thief.shadow-flare",
        reason: "Shadow Swap is unavailable — cast Shadow Flare first.",
      };
    }
  }
  if (!skill.stealthAttack) return { ready: true };
  if (skill.malicious) return { ready: true };
  return {
    ready: false,
    retryAt: null,
    code: "thief.malicious-replacement",
    reason: `${skill.name} is unavailable — the malicious version replaces it.`,
  };
}
