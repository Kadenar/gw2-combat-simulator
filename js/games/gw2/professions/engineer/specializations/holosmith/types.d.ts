import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

/**
 * Owns skill metadata consumed only by Holosmith mechanics, keeping heat and
 * Photon Forge concerns out of the shared Engineer skill contract.
 */
export interface HolosmithSkill extends EngineerSkill {
  readonly forgeSkill?: boolean;
  readonly heatGain?: number;
  readonly heatLoss?: number;
}

/** Strongly types Holosmith-only fields while retaining the shared skill-fragment vocabulary. */
export type HolosmithSkillFragment = SkillFragment &
  Partial<Pick<HolosmithSkill, 'forgeSkill' | 'heatGain' | 'heatLoss'>>;
