/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import type { SkillHandlerStrategy } from '#gw2/platform/engine/types.js';
import type { MesmerHandlerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import {
  scheduleMesmerPhantasmEffects,
  withMesmerCastEmission
} from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';

export const mesmerReplaceProfile = replaceSkill<MesmerHandlerContext>({ beforeEffects: () => null });

// Dynamic phantasm and clone packets register with the cast instead of appearing retroactively at completion.
const mesmerPhantasm = replaceSkill<MesmerHandlerContext>({
  beforeEffects: (context, skill) => scheduleMesmerPhantasmEffects(context, skill as MesmerSkill)
});
const mesmerAxesOfSymmetry = augmentSkill<MesmerHandlerContext>({
  afterEffects: (context, skill) =>
    withMesmerCastEmission(context, skill as MesmerSkill, () =>
      context.mesmerRuntime.skillEffects.scheduleSpecial(skill as MesmerSkill, context.fullEnd, context.start)
    )
});

// Mind Spike is the only fixed profile whose coefficient depends on runtime target state.
const mesmerMindSpike = augmentSkill<MesmerHandlerContext>({
  afterEffect: (context, skill, event) => {
    if (event.type === 'damage' && context.config.target?.boonless && skill.boonlessCoefficient) {
      context.replaceEvent(event, { coefficient: skill.boonlessCoefficient });
    }
  }
});

export const mesmerCoreSkillHandlers: Readonly<Record<string, Readonly<SkillHandlerStrategy<MesmerHandlerContext>>>> =
  Object.freeze({
    'mesmer.axes-of-symmetry': mesmerAxesOfSymmetry,
    'mesmer.mind-spike': mesmerMindSpike,
    'mesmer.weapon-swap': gw2WeaponSwapSkillHandler,
    'mesmer.shatter': mesmerReplaceProfile,
    'mesmer.phantasm': mesmerPhantasm
  });
