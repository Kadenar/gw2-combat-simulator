import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { necromancerCoreTooltips } from '#gw2/professions/necromancer/app/tooltips/core.js';
import { reaperTooltips } from '#gw2/professions/necromancer/app/tooltips/reaper.js';
import { scourgeTooltips } from '#gw2/professions/necromancer/app/tooltips/scourge.js';
import { harbingerTooltips } from '#gw2/professions/necromancer/app/tooltips/harbinger.js';
import { ritualistTooltips } from '#gw2/professions/necromancer/app/tooltips/ritualist.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const necromancerTooltips: ProfessionTooltips = {
  skillFacts: necromancerCoreTooltips.skillFacts,
  skills: {
    ...necromancerCoreTooltips.skills,
    ...reaperTooltips.skills,
    ...scourgeTooltips.skills,
    ...harbingerTooltips.skills,
    ...ritualistTooltips.skills
  },
  traits: {
    ...necromancerCoreTooltips.traits,
    ...reaperTooltips.traits,
    ...scourgeTooltips.traits,
    ...harbingerTooltips.traits,
    ...ritualistTooltips.traits
  }
};
