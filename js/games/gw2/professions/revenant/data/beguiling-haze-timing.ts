import type { Skill } from '#gw2/platform/skills/types.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';

/** Use the selected follow-up skill's duration in simulation and import while retaining the main activation. */
export function beguilingHazeCastDuration(duration: number, followUp: boolean, followUpSkill: Skill): number {
  return followUp ? skillNumber(followUpSkill, 'castTimeMs') / 1000 : duration;
}
