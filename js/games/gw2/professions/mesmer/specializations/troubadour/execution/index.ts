import { replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { scheduleTroubadourPerformance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import type { MesmerHandlerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Performance handlers replace fixed profiles with packets registered at cast start.
export const troubadourPerformanceProfile = replaceSkill<MesmerHandlerContext>({
  beforeEffects: (context, skill) => scheduleTroubadourPerformance(context, skill as MesmerSkill)
});
