import type { MesmerShatter, MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import {
  triggerIllusionaryMembrane,
  triggerMaimTheDisillusioned
} from '#gw2/professions/mesmer/core/traits/behavior.js';
import type { MesmerMechanics } from '#gw2/professions/mesmer/types.js';
import { triggerRendingShatter } from '#gw2/professions/mesmer/core/traits/domination.js';

/** Preserve Maim before Illusionary Membrane after shared shatter materialization. */
export function triggerMesmerPostShatterTraits(
  context: Readonly<Pick<MesmerMechanics, 'context' | 'addEvent' | 'addCondition' | 'addTraitProc'>>,
  shatter: MesmerShatter | undefined,
  resolution: MesmerShatterResolution
): void {
  triggerMaimTheDisillusioned(context, resolution);
  triggerRendingShatter(context.context, resolution);
  triggerIllusionaryMembrane(context, shatter, resolution.skill.name, resolution.at);
}
