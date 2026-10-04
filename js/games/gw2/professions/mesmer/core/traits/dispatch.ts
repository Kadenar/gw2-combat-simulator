import type { MesmerShatter, MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { triggerChaoticInterruption, triggerIllusionaryMembrane } from '#gw2/professions/mesmer/core/traits/chaos.js';
import { triggerIneptitudeFromInterrupt } from '#gw2/professions/mesmer/core/traits/dueling.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { triggerMaimTheDisillusioned } from '#gw2/professions/mesmer/core/traits/illusions.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { triggerRendingShatter } from '#gw2/professions/mesmer/core/traits/domination.js';

/** Accepted control resolves Chaos recharge before Dueling's interrupt reaction at the same impact. */
export function triggerMesmerControlTraits(context: MesmerRuntime, event: SimulationEvent): void {
  triggerChaoticInterruption(context, event, event.skillName ?? event.name ?? 'Control effect');
  triggerIneptitudeFromInterrupt(context, event);
}

/** Preserve Maim, Rending Shatter, then Illusionary Membrane after shared shatter materialization. */
export function triggerMesmerPostShatterTraits(
  context: MesmerRuntime,
  shatter: MesmerShatter | undefined,
  resolution: MesmerShatterResolution
): void {
  triggerMaimTheDisillusioned(context, resolution);
  triggerRendingShatter(context, shatter, resolution);
  triggerIllusionaryMembrane(context, shatter, resolution.skill.name, resolution.at, resolution.delivery);
}
