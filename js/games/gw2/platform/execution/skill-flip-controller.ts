/** Execution owns live flip lifetimes independently of replaceable profession state. */
import {
  armSkillFlip,
  consumeSkillFlip,
  expireSkillFlip,
  type SkillFlipCommands,
  type SkillFlipWindows
} from '#gw2/platform/execution/skill-flips.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

interface SkillFlipControllerOptions {
  readonly clock: { readonly time: number };
  readonly scheduleExpiry: (skillId: SkillId, identity: number | string, at: number) => void;
}

export function createSkillFlipController({ clock, scheduleExpiry }: SkillFlipControllerOptions): SkillFlipCommands {
  const flips: SkillFlipWindows = {};
  return Object.freeze({
    flips,
    armFlip(skillId, { availableAt = clock.time, expiresAt = Infinity, visibleAt, identity, uses } = {}) {
      const window = armSkillFlip(flips, skillId, availableAt, expiresAt, visibleAt ?? availableAt, identity, uses);

      if (window.expiresAt != null) scheduleExpiry(skillId, window.identity, window.expiresAt);

      return window;
    },
    consumeFlip: (skillId) => consumeSkillFlip(flips, skillId),
    clearFlip(skillId) {
      delete flips[skillId];
    },
    expireFlip: (skillId, identity) => expireSkillFlip(flips, skillId, clock.time, identity)
  } satisfies SkillFlipCommands);
}
