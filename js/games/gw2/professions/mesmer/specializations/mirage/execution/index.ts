import { replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { scheduleProfileControls } from '#gw2/professions/mesmer/core/execution/index.js';
import { withMesmerCastEmission } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mirageControllerFor } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import type { MesmerHandlerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Ambush packets register at cast start so overlapping actions observe them chronologically.
export const mesmerAmbushProfile = replaceSkill<MesmerHandlerContext>({
  beforeEffects: (context, skill) => {
    // An uncommitted ambush must leave its cloak window available for the next weapon's ambush.
    if (context.action.cancelled) return;
    withMesmerCastEmission(context, skill as MesmerSkill, () =>
      mirageControllerFor(context.mesmerRuntime).executePlayerAmbush(
        skill as MesmerSkill,
        context.fullEnd,
        context.start
      )
    );
  },
  afterEffects: scheduleProfileControls
});
