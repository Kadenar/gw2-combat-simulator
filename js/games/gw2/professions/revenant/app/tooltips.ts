import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { revenantCoreTooltips } from '#gw2/professions/revenant/app/tooltips/core.js';
import { heraldTooltips } from '#gw2/professions/revenant/app/tooltips/herald.js';
import { renegadeTooltips } from '#gw2/professions/revenant/app/tooltips/renegade.js';
import { vindicatorTooltips, vindicatorReworkTooltips } from '#gw2/professions/revenant/app/tooltips/vindicator.js';
import { conduitTooltips } from '#gw2/professions/revenant/app/tooltips/conduit.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const revenantTooltips: ProfessionTooltips = {
  reworks: { 'vindicator-rework': vindicatorReworkTooltips },
  skillFacts: revenantCoreTooltips.skillFacts,
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
