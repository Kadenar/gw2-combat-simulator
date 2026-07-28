import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { engineerCatalog } from "../catalog.js";

const IMPLEMENTED = new Set([
  "Glass Cannon",
  "Shaped Charge",
  "Blast Shield",
  "Excessive Energy",
  "Gadgeteer",
  "Chemical Rounds",
  "High Caliber",
  "Thermal Vision",
  "Modified Ammunition",
  "Mass Momentum",
  "Applied Force",
  "Mechanized Deployment",
  "Mech Arms: Single-Edge Cutters",
  "Mech Arms: High-Impact Drivers",
  "Mech Arms: Jade Cannons",
  "Mech Frame: Conductive Alloys",
  "Mech Frame: Channeling Conduits",
  "Mech Frame: Variable Mass Distributor",
  "Mech Core: Jade Dynamo",
  "Mech Core: Barrier Engine",
  "Mech Core: J-Drive",
  "Laser's Edge",
  "Enhanced Capacity Storage Unit",
]);

const manifest = engineerCatalog.traits.map(trait => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  const description = String(trait.description || "").trim()
    || `Reviewed passive or utility behavior for ${trait.name}.`;
  return {
    traitId: trait.id,
    status,
    effects: [{
      description,
      status,
      ...(implemented ? {} : {
        reason:
          "This defensive, support, movement, healing, or competitive-only effect does not change the simulator's target damage model.",
      }),
    }],
    ...(implemented ? {
      tests: ["tests/engineer.test.js#trait-coverage"],
    } : {
      reason:
        "This defensive, support, movement, healing, or competitive-only effect does not change the simulator's target damage model.",
    }),
  };
});

export const ENGINEER_TRAIT_COVERAGE = validateTraitCoverageManifest(
  engineerCatalog,
  manifest,
  { professionId: "engineer" },
);

