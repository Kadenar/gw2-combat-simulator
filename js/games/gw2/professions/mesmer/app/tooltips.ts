import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { chronomancerTooltips } from '#gw2/professions/mesmer/app/tooltips/chronomancer.js';
import { mesmerCoreTooltips } from '#gw2/professions/mesmer/app/tooltips/core.js';
import { mirageTooltips } from '#gw2/professions/mesmer/app/tooltips/mirage.js';
import { troubadourTooltips } from '#gw2/professions/mesmer/app/tooltips/troubadour.js';
import { virtuosoTooltips } from '#gw2/professions/mesmer/app/tooltips/virtuoso.js';
import { misdirectionSkill, shatterStormMaximumAmmo } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { type MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const mesmerTooltips: ProfessionTooltips = {
  skillCosts(_context, entity, selection) {
    const skill = entity as MesmerSkill;
    return {
      ammo: shatterStormMaximumAmmo(selection, skill, skill.ammo ?? 0),
      cooldown:
        misdirectionSkill(skill) && selection.hasTrait(TRAIT.MASTER_OF_MISDIRECTION)
          ? gw2BaseRecharge(skill) *
            balanceProfileNumber(selection.requireBalanceProfile(TRAIT.MASTER_OF_MISDIRECTION), 'rechargeMultiplier')
          : undefined
    };
  },
  skillFacts: mesmerCoreTooltips.skillFacts,
  skills: {
    ...mesmerCoreTooltips.skills,
    ...chronomancerTooltips.skills,
    ...mirageTooltips.skills,
    ...virtuosoTooltips.skills,
    ...troubadourTooltips.skills
  },
  traits: {
    ...mesmerCoreTooltips.traits,
    ...chronomancerTooltips.traits,
    ...mirageTooltips.traits,
    ...virtuosoTooltips.traits,
    ...troubadourTooltips.traits
  }
};
