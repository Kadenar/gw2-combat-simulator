import { augmentSkill } from '../../../../platform/gw2/authoring/mechanics.js';
import type { SkillHandlerPhase } from '../../../../platform/engine/types.js';
import type { RevenantCastContext } from '../../types.js';
import { performEnergyMeld, switchAllianceTactics } from './dodge.js';

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
