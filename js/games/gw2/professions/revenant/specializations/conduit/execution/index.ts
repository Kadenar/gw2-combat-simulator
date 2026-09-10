/** Registers Conduit cast callbacks while implementations remain with their skill families. */
import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/execution/types.js';
import type { RevenantCastContext } from '#gw2/professions/revenant/types.js';
import {
  castBeguilingHaze,
  castGladiatorsDefense,
  castHexEaterVortex,
  castTwinMoonSweep
} from '#gw2/professions/revenant/specializations/conduit/execution/entities.js';
import { castReleasePotential } from '#gw2/professions/revenant/specializations/conduit/execution/release-potential.js';
import { activateCosmicWisdom } from '#gw2/professions/revenant/specializations/conduit/execution/cosmic-wisdom.js';

/** Selects Conduit packets from live legend and affinity state at cast time. */
const handlers = Object.freeze({
  'revenant.beguiling-haze': replaceSkill<RevenantCastContext>({
    beforeEffects: castBeguilingHaze as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.gladiators-defense': replaceSkill<RevenantCastContext>({
    beforeEffects: castGladiatorsDefense as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.hex-eater-vortex': replaceSkill<RevenantCastContext>({
    beforeEffects: castHexEaterVortex as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.twin-moon-sweep': replaceSkill<RevenantCastContext>({
    beforeEffects: castTwinMoonSweep as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.release-potential': replaceSkill<RevenantCastContext>({
    beforeEffects: castReleasePotential as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.cosmic-wisdom': augmentSkill<RevenantCastContext>({
    afterEffects: activateCosmicWisdom as SkillHandlerPhase<RevenantCastContext>
  })
});

export const conduitSkillHandlers = new Map(Object.entries(handlers));
