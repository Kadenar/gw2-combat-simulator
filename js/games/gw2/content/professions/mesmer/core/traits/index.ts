/** Public dispatcher for imperative Core Mesmer trait behavior. */
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import type {
  MesmerSchedulerContext,
  MesmerSchedulerTask,
  MesmerShatter,
  MesmerShatterResolution
} from '#gw2/content/professions/mesmer/types.js';
import {
  triggerChaoticInterruption,
  triggerIllusionaryMembrane,
  type MesmerIllusionaryMembraneContext
} from '#gw2/content/professions/mesmer/core/traits/chaos.js';
import {
  triggerMasterFencer,
  triggerSharperImages,
  type MesmerDuelingCriticalContext
} from '#gw2/content/professions/mesmer/core/traits/dueling.js';
import {
  triggerMaimTheDisillusioned,
  type MesmerMaimContext
} from '#gw2/content/professions/mesmer/core/traits/illusions.js';

export { triggerDazzling } from '#gw2/content/professions/mesmer/core/traits/domination.js';
export {
  emitFencersFinesseStacks,
  recordFencersFinesseProc,
  triggerBlindingDissipation,
  triggerIneptitudeFromBlind,
  triggerIneptitudeFromInterrupt
} from '#gw2/content/professions/mesmer/core/traits/dueling.js';
export { triggerMethodOfMadness } from '#gw2/content/professions/mesmer/core/traits/chaos.js';
export {
  applyCryOfPain,
  phantasmalHasteSpeed,
  triggerCompoundingPower
} from '#gw2/content/professions/mesmer/core/traits/illusions.js';

type MesmerPostShatterTraitContext = MesmerIllusionaryMembraneContext & MesmerMaimContext;

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
  context: MesmerPostShatterTraitContext,
  shatter: MesmerShatter | undefined,
  resolution: MesmerShatterResolution,
  epsilon: number
): void {
  triggerMaimTheDisillusioned(context, resolution);
  triggerIllusionaryMembrane(context, shatter, resolution.skill.name, resolution.at, epsilon);
}

/** Evaluates Chaotic Interruption when a delayed control packet actually lands. */
export function handleChaoticInterruptionTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'chaoticInterruption'>
): void {
  triggerChaoticInterruption(
    context,
    { type: 'control', at: task.at, source: 'Skill', sourceId: task.payload.skillId },
    task.payload.skillName
  );
}

export { triggerChaoticInterruption };
