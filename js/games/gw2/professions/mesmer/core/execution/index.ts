/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import type { SkillHandlerStrategy } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { MesmerHandlerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import {
  isCommittedInterruptedPhantasm,
  scheduleMesmerPhantasmEffects,
  withMesmerCastEmission
} from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';

/** Replacing handlers own their damage, but still honor skill-authored CC and its interruption window. */
function scheduleProfileControls(context: MesmerHandlerContext, skill: Skill): void {
  if (context.action.cancelled) return;
  const end =
    context.effectiveEnd >= context.fullEnd - context.epsilon ||
    isCommittedInterruptedPhantasm(context, skill as MesmerSkill)
      ? Infinity
      : context.effectiveEnd;
  for (const effect of skill.effects || []) {
    if (effect.type !== 'control') continue;
    for (const application of materializeSkillEffectApplications({
      skill,
      effect,
      start: context.start,
      fullEnd: context.fullEnd,
      baseEvent: {
        activationId: context.reservationId,
        source: effect.source || 'Player',
        sourceId: effect.sourceId ?? skill.id,
        actorType: effect.actorType || 'player',
        skillId: skill.id,
        skillName: skill.name
      }
    })) {
      if (application.at <= end + context.epsilon) context.emit(application.event);
    }
  }
}

export const mesmerReplaceProfile = replaceSkill<MesmerHandlerContext>({ afterEffects: scheduleProfileControls });

// Dynamic phantasm and clone packets register with the cast instead of appearing retroactively at completion.
const mesmerPhantasm = replaceSkill<MesmerHandlerContext>({
  beforeEffects: (context, skill) => scheduleMesmerPhantasmEffects(context, skill as MesmerSkill),
  afterEffects: scheduleProfileControls
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
    'mesmer.inspiring-imagery': mesmerReplaceProfile,
    'mesmer.phantasm': mesmerPhantasm
  });
