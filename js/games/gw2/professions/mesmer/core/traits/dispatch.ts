import type { MesmerShatter, MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import {
  triggerIllusionaryMembrane,
  triggerMaimTheDisillusioned
} from '#gw2/professions/mesmer/core/traits/behavior.js';
import type { MesmerMechanics } from '#gw2/professions/mesmer/types.js';

/** Preserve Maim before Illusionary Membrane after shared shatter materialization. */
export function triggerMesmerPostShatterTraits(
  context: Readonly<Pick<MesmerMechanics, 'context' | 'addEvent' | 'addCondition' | 'addTraitProc'>>,
  shatter: MesmerShatter | undefined,
  resolution: MesmerShatterResolution
): void {
  triggerMaimTheDisillusioned(context, resolution);
  triggerIllusionaryMembrane(context, shatter, resolution.skill.name, resolution.at);
}
