import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { ThiefPrecastContext, ThiefSkill } from '#gw2/professions/thief/types.js';

export function daredevilCastAvailability(context: ThiefPrecastContext, skill: ThiefSkill): AvailabilityResult {
  if (skill.id !== ID.PALM_STRIKE) return { ready: true };
  // Palm Strike is only castable during the window opened by a completed, on-target Flurry.
  if (skillFlipReady(professionCoreState(context).availableFlips[ID.PALM_STRIKE], context.start)) {
    return { ready: true };
  }

  return {
    ready: false,
    // retryAt: null because there is no timer to poll — the window only opens on Fist Flurry hit
    retryAt: null,
    code: 'thief.palm-strike',
    reason: 'Palm Strike is unavailable — Fist Flurry must connect first.'
  };
}
