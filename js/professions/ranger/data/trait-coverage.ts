import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { rangerCatalog } from "../catalog.js";

const IMPLEMENTED = new Set([
  "Tail Wind",
  "Furious Grip",
  "Hunter's Tactics",
  "Sharpened Edges",
  "Trapper's Expertise",
  "Opening Strike",
  "Alpha Focus",
  "Precise Strike",
  "Hunter's Gaze",
  "Clarion Bond",
  "Wolfsong",
  "Farsighted",
  "Predator's Onslaught",
  "Remorseless",
  "Rejuvenation",
  "Bountiful Hunter",
  "Wellspring",
  "Spirited Arrival",
  "Windborne Notes",
  "Hidden Barbs",
  "Vicious Quarry",
  "Pack Alpha",
  "Loud Whistle",
  "Pet's Prowess",
  "Go for the Eyes",
  "Resounding Timbre",
  "Wilting Strike",
  "Bestial Rage",
  "Honed Axes",
  "Quick Draw",
  "Go for the Throat",
  "Strider's Strength",
  "Lingering Magic",
  "Natural Vigor",
  "Child of Earth",
  "Arachnophobia",
  "Ambidexterity",
  "Survival Instincts",
  "Carnivore",
  "Poison Master",
  "Elevated Bond",
  "Furious Strength",
  "Twice as Vicious",
  "Live Fast",
  "Unstoppable Union",
  "Essence of Speed",
  "Predator's Cunning",
  "Leader of the Pack",
  "Oppressive Superiority",
  "Unleashed Power",
  "Natural Fortitude",
  "Vow of the Untamed",
  "Debilitating Blows",
  "Blinding Outburst",
  "Enhancing Impact",
  "Let Loose",
  "Ferocious Symbiosis",
  "Teachings of the Tengu",
  "Bird of Prey",
  "Wuthering Wind",
  "Flock Together",
  "Perilous Skies",
  "Thrill of the Catch",
  "Cloudburst",
  "Gale Force",
  "Shrike",
]);

const manifest = rangerCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  const reason = implemented
    ? undefined
    : "Healing, defense, movement, allied support, or an unmodeled proc is outside the current single-target damage model.";
  return {
    traitId: trait.id,
    status,
    effects: [
      {
        description: String(trait.description || `Reviewed ${trait.name}.`),
        status,
        ...(reason ? { reason } : {}),
      },
    ],
    ...(implemented
      ? {
          tests: [
            {
              file: "tests/professions/ranger/ranger.test.js",
              name: "Ranger trait rules affect their owned damage and attributes",
            },
          ],
        }
      : { reason }),
  };
});

export const RANGER_TRAIT_COVERAGE = validateTraitCoverageManifest(
  rangerCatalog,
  manifest,
  { professionId: "ranger" },
);
