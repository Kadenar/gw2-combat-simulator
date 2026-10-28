import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { amalgamTooltips } from '#gw2/professions/engineer/app/tooltips/amalgam.js';
import { engineerCoreTooltips } from '#gw2/professions/engineer/app/tooltips/core.js';
import { holosmithTooltips } from '#gw2/professions/engineer/app/tooltips/holosmith.js';
import { mechanistTooltips } from '#gw2/professions/engineer/app/tooltips/mechanist.js';
import { scrapperTooltips } from '#gw2/professions/engineer/app/tooltips/scrapper.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const engineerTooltips: ProfessionTooltips = {
  skillFacts: holosmithTooltips.skillFacts,
  skills: {
    ...engineerCoreTooltips.skills,
    ...scrapperTooltips.skills,
    ...holosmithTooltips.skills,
    ...mechanistTooltips.skills,
    ...amalgamTooltips.skills
  },
  traits: {
    ...engineerCoreTooltips.traits,
    ...scrapperTooltips.traits,
    ...holosmithTooltips.traits,
    ...mechanistTooltips.traits,
    ...amalgamTooltips.traits
  }
};
