import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_TRAIT_IDS as TRAIT, MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Arms Danger Time from Chronomancer control packets and Delayed Reactions. */
export function observeChronomancerEvent(context: MesmerRuntime, event: SimulationEvent): void {
  if (event.type !== 'control') return;
  const runtime = mesmerMechanicsFor(context);
  const skillId = Number(event.skillId);
  if (
    !runtime.traits.has(TRAIT.DANGER_TIME) ||
    (skillId !== ID.TIME_SINK && !runtime.traits.has(TRAIT.DELAYED_REACTIONS))
  ) {
    return;
  }

  const skillName = String(event.skillName || event.name || 'Control effect');
  const dangerTimeProfile = requireBalanceProfileFromContext(runtime, TRAIT.DANGER_TIME);
  runtime.addEvent({
    type: 'buff',
    at: event.at,
    kind: 'danger-time',
    stacks: 1,
    duration: balanceProfileNumber(dangerTimeProfile, 'durationMultiplier'),
    sourceSkill: skillName
  });
  runtime.addTraitProc('Danger Time', event.at, skillName);
}
