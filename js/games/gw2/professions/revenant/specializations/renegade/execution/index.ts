/** Registers scheduler-phase skill activations for this module. */
import { SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import type { Skill, SkillHandlerMode } from '#gw2/platform/engine/skills/types.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/execution/types.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { revenantAssassinRenegadeSkillHandlers } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import type { BandTogetherState } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';

const bandTogether = revenantAssassinRenegadeSkillHandlers['revenant.band-together'];

function bandTogetherHandlerMode(context: RevenantCastContext, skill: Skill): SkillHandlerMode {
  // Enhanced casts replace the selectable skill's effects with the declared 72xxx profile.
  return bandTogether.replacesEffects(context, skill) ? SKILL_HANDLER_MODES.REPLACE : SKILL_HANDLER_MODES.AUGMENT;
}

const handlers = Object.freeze({
  // These effects are templates: the handler selects a trait-adjusted profile and materializes it after resolving live state.
  'revenant.heroic-command': replaceSkill<RevenantCastContext>({
    afterEffects: revenantAssassinRenegadeSkillHandlers[
      'revenant.heroic-command'
    ] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.orders-from-above': replaceSkill<RevenantCastContext>({
    afterEffects: revenantAssassinRenegadeSkillHandlers[
      'revenant.orders-from-above'
    ] as SkillHandlerPhase<RevenantCastContext>
  }),
  // Band Together uses dynamic mode: enhanced casts replace the base profile; normal casts remain declarative.
  'revenant.band-together': augmentSkill<RevenantCastContext>({
    beforeEffects: bandTogether.beforeEffects as SkillHandlerPhase<RevenantCastContext>,
    resolveMode: bandTogetherHandlerMode,
    afterEffects: (context, skill, state) =>
      bandTogether.afterEffects(context, skill as RevenantSkill, state as BandTogetherState)
  })
});

export const renegadeSkillHandlers = new Map(Object.entries(handlers));
