/** Registers scheduler-phase skill activations for this module. */
import { SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import { augmentSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/types.js';
import type { RevenantCastContext } from '#gw2/content/professions/revenant/types.js';
import { revenantConduitSkillHandlers } from '#gw2/content/professions/revenant/specializations/conduit/skills/effects.js';

const handlers = Object.freeze({
  // Handlers select from declarative packets using live legend/affinity state.
  'revenant.beguiling-haze': augmentSkill<RevenantCastContext>({
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    beforeEffects: revenantConduitSkillHandlers['revenant.beguiling-haze'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.gladiators-defense': augmentSkill<RevenantCastContext>({
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    beforeEffects: revenantConduitSkillHandlers['revenant.gladiators-defense'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.hex-eater-vortex': augmentSkill<RevenantCastContext>({
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    beforeEffects: revenantConduitSkillHandlers['revenant.hex-eater-vortex'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.twin-moon-sweep': augmentSkill<RevenantCastContext>({
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    beforeEffects: revenantConduitSkillHandlers['revenant.twin-moon-sweep'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.release-potential': augmentSkill<RevenantCastContext>({
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    beforeEffects: revenantConduitSkillHandlers['revenant.release-potential'] as SkillHandlerPhase<RevenantCastContext>
  }),
  // Cosmic Wisdom augments so base energy cost fires first before the afterEffects handler
  'revenant.cosmic-wisdom': augmentSkill<RevenantCastContext>({
    afterEffects: revenantConduitSkillHandlers['revenant.cosmic-wisdom'] as SkillHandlerPhase<RevenantCastContext>
  })
});

export const conduitSkillHandlers = new Map(Object.entries(handlers));
