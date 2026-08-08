import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { rangerCatalog } from "../catalog.js";

const IMPLEMENTED = new Set([
  "Hunter's Tactics",
  "Farsighted",
  "Predator's Onslaught",
  "Hidden Barbs",
  "Vicious Quarry",
  "Pet's Prowess",
  "Honed Axes",
  "Strider's Strength",
  "Lingering Magic",
  "Arachnophobia",
  "Ambidexterity",
  "Survival Instincts",
  "Poison Master",
  "Furious Strength",
  "Oppressive Superiority",
  "Vow of the Untamed",
  "Bird of Prey",
  "Gale Force",
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
