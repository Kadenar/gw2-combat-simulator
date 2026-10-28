import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { rangerCoreTooltips } from '#gw2/professions/ranger/app/tooltips/core.js';
import { druidTooltips } from '#gw2/professions/ranger/app/tooltips/druid.js';
import { galeshotTooltips } from '#gw2/professions/ranger/app/tooltips/galeshot.js';
import { soulbeastTooltips } from '#gw2/professions/ranger/app/tooltips/soulbeast.js';
import { untamedTooltips } from '#gw2/professions/ranger/app/tooltips/untamed.js';

/** The app combines owner-local descriptions; runtime modules never depend on presentation. */
export const rangerTooltips: ProfessionTooltips = {
  skillFacts: (context, entity) => [
    ...rangerCoreTooltips.skillFacts(context, entity),
    ...galeshotTooltips.skillFacts(context, entity)
  ],
  skills: {
    ...rangerCoreTooltips.skills,
    ...soulbeastTooltips.skills,
    ...druidTooltips.skills,
    ...untamedTooltips.skills,
    ...galeshotTooltips.skills
  },
  traits: {
    ...rangerCoreTooltips.traits,
    ...soulbeastTooltips.traits,
    ...druidTooltips.traits,
    ...untamedTooltips.traits,
    ...galeshotTooltips.traits
  }
};
