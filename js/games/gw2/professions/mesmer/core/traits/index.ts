/** Public dispatcher for imperative Core Mesmer trait behavior. */
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { MesmerShatter, MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { triggerChaoticInterruption, triggerIllusionaryMembrane } from '#gw2/professions/mesmer/core/traits/chaos.js';
import {
  triggerMasterFencer,
  triggerSharperImages,
  type MesmerDuelingCriticalContext
} from '#gw2/professions/mesmer/core/traits/dueling.js';
import { triggerMaimTheDisillusioned } from '#gw2/professions/mesmer/core/traits/illusions.js';
import type { MesmerMechanics } from '#gw2/professions/mesmer/types.js';

export { scheduleBountifulBlades, triggerDazzling } from '#gw2/professions/mesmer/core/traits/domination.js';
export {
  emitFencersFinesseStacks,
  recordFencersFinesseProc,
  triggerBlindingDissipation,
  triggerIneptitudeFromBlind,
  triggerIneptitudeFromInterrupt
} from '#gw2/professions/mesmer/core/traits/dueling.js';
export { triggerMethodOfMadness } from '#gw2/professions/mesmer/core/traits/chaos.js';
export {
  applyCryOfPain,
  phantasmalHasteSpeed,
  triggerCompoundingPower,
  triggerMasterOfFragmentation,
  triggerThePledge
} from '#gw2/professions/mesmer/core/traits/illusions.js';

/** Preserves Master Fencer before Sharper Images for one critical observation. */
export function triggerMesmerCriticalTraits(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  triggerMasterFencer(context, event, chance);
  triggerSharperImages(context, event, chance);
}

/** Preserves Maim before Illusionary Membrane after shatter packet resolution. */
export function triggerMesmerPostShatterTraits(
  context: Readonly<Pick<MesmerMechanics, 'traits' | 'addEvent' | 'addCondition' | 'addTraitProc' | 'balanceProfile'>>,
  shatter: MesmerShatter | undefined,
  resolution: MesmerShatterResolution
): void {
  triggerMaimTheDisillusioned(context, resolution);
  triggerIllusionaryMembrane(context, shatter, resolution.skill.name, resolution.at);
}

export { triggerChaoticInterruption };
