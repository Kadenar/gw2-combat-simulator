/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/types.js';
import type { RevenantCastContext } from '#gw2/content/professions/revenant/types.js';
import {
  performEnergyMeld,
  switchAllianceTactics
} from '#gw2/content/professions/revenant/specializations/vindicator/mechanics/dodge.js';

// augmentSkill: platform processes base cast (energy cost, recharge, etc.) first, then afterEffects runs
const handlers = Object.freeze({
  'revenant.energy-meld': augmentSkill<RevenantCastContext>({
    afterEffects: performEnergyMeld as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.alliance-tactics': augmentSkill<RevenantCastContext>({
    afterEffects: switchAllianceTactics
  })
});

export const vindicatorSkillHandlers = new Map(Object.entries(handlers));
