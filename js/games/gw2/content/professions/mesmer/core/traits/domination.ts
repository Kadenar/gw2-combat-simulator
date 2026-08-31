/** Owns imperative Core Mesmer Domination trait effects. */
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import type { MesmerSchedulerContext } from '#gw2/content/professions/mesmer/types.js';

/** Emits Dazzling's control observation without taking ownership of control-event classification. */
export function triggerDazzling(
  context: MesmerSchedulerContext,
  event: SimulationEvent,
  skillId: number,
  skillName: string
): void {
  const runtime = context.mesmerRuntime;
  if (!runtime?.traits.has(TRAIT.DAZZLING)) return;
  runtime.addEvent({
    type: 'weakness_vulnerability',
    at: event.at,
    skillId: Number.isFinite(skillId) ? skillId : undefined,
    skillName
  });
}
