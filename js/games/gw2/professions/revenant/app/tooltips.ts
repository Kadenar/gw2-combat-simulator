import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { conduitTooltips } from '#gw2/professions/revenant/app/tooltips/conduit.js';
import { revenantCoreTooltips } from '#gw2/professions/revenant/app/tooltips/core.js';
import { heraldTooltips } from '#gw2/professions/revenant/app/tooltips/herald.js';
import { revenantModifierDescriptions } from '#gw2/professions/revenant/app/tooltips/modifiers.js';
import { renegadeTooltips } from '#gw2/professions/revenant/app/tooltips/renegade.js';
import { vindicatorTooltips } from '#gw2/professions/revenant/app/tooltips/vindicator.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const revenantTooltips: ProfessionTooltips = {
  modifiers: revenantModifierDescriptions,
  // Both Energy Meld identities share the selected Vindicator cost rules.
  skillCosts(_context, skill, selection) {
    if (skill.id !== ID.ENERGY_MELD && skill.id !== ID.ENERGY_MELD_ID_72058) return;

    return {
      cooldown: selection.hasTrait(TRAIT.REAVERS_CURSE)
        ? (skill.cooldown ?? 0) *
          balanceProfileNumber(selection.requireBalanceProfile(TRAIT.REAVERS_CURSE), 'rechargeMultiplier')
        : undefined,
      energyCost: selection.hasTrait(TRAIT.ANGSIYANS_TRUST) ? 0 : undefined
    };
  },
  skillFacts: (context, skill, build) => [
    ...revenantCoreTooltips.skillFacts(context, skill),
    ...vindicatorTooltips.skillFacts(context, skill, build)
  ],
  groupSkillFacts: conduitTooltips.groupSkillFacts,
  skills: {
    ...revenantCoreTooltips.skills,
    ...heraldTooltips.skills,
    ...renegadeTooltips.skills,
    ...vindicatorTooltips.skills,
    ...conduitTooltips.skills
  },
  traits: {
    ...revenantCoreTooltips.traits,
    ...heraldTooltips.traits,
    ...renegadeTooltips.traits,
    ...vindicatorTooltips.traits,
    ...conduitTooltips.traits
  }
};
