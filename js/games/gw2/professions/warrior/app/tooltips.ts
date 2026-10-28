import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { berserkerTooltips } from '#gw2/professions/warrior/app/tooltips/berserker.js';
import { bladeswornTooltips } from '#gw2/professions/warrior/app/tooltips/bladesworn.js';
import { warriorCoreTooltips } from '#gw2/professions/warrior/app/tooltips/core.js';
import { paragonTooltips } from '#gw2/professions/warrior/app/tooltips/paragon.js';
import { spellbreakerTooltips } from '#gw2/professions/warrior/app/tooltips/spellbreaker.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const warriorTooltips: ProfessionTooltips = {
  skillFacts: (context, entity) => [
    ...warriorCoreTooltips.skillFacts(context, entity),
    ...berserkerTooltips.skillFacts(context, entity)
  ],
  skills: {
    ...warriorCoreTooltips.skills,
    ...berserkerTooltips.skills,
    ...spellbreakerTooltips.skills,
    ...bladeswornTooltips.skills,
    ...paragonTooltips.skills
  },
  traits: {
    ...warriorCoreTooltips.traits,
    ...berserkerTooltips.traits,
    ...spellbreakerTooltips.traits,
    ...bladeswornTooltips.traits,
    ...paragonTooltips.traits
  }
};
