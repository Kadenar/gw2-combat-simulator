import type { MesmerResourceSpendDetails } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerContinuumController {
  beginContinuumSplit(
    skill: MesmerSkill,
    at: number,
    spendDetails?: MesmerResourceSpendDetails
  ): MesmerShatterResolution;
  restoreContinuum(at: number, reason: string): void;
}
