import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type { ThiefSkill } from "../../types.js";

export function deadeyeCastAvailability(
  _context: unknown,
  skill: ThiefSkill,
): AvailabilityResult {
  if (!skill.stealthAttack) return { ready: true };
  if (skill.malicious) return { ready: true };
  return {
    ready: false,
    retryAt: null,
    code: "thief.malicious-replacement",
    reason:
      `${skill.name} is unavailable — the malicious version replaces it.`,
  };
}
