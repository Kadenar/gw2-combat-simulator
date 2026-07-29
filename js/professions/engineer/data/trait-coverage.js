import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { engineerCatalog } from "../catalog.js";

const IMPLEMENTED = new Set([
  "Explosive Entrance",
  "Steel-Packed Powder",
  "Glass Cannon",
  "Shaped Charge",
  "Aim-Assisted Rocket",
  "Shrapnel",
  "Blast Shield",
  "Excessive Energy",
  "Gadgeteer",
  "Serrated Steel",
  "Hematic Focus",
  "Chemical Rounds",
  "High Caliber",
  "Thermal Vision",
  "Modified Ammunition",
  "Incendiary Powder",
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
  "Willing Host",
  "Hardened Chrome",
  "Carbolic Composition",
  "New Genes",
]);

const manifest = engineerCatalog.traits.map(trait => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.PENDING;
  const description = String(trait.description || "").trim()
    || `Reviewed passive or utility behavior for ${trait.name}.`;
  const pendingReason =
    "This behavior has not yet been implemented and verified against a behavioral simulation test.";
  return {
    traitId: trait.id,
    status,
    effects: [{
      description,
      status,
      ...(implemented ? {} : {
        reason: pendingReason,
      }),
    }],
    ...(implemented ? {
      tests: ["tests/engineer.test.js#trait-coverage"],
    } : {
      reason: pendingReason,
    }),
  };
});

export const ENGINEER_TRAIT_COVERAGE = validateTraitCoverageManifest(
  engineerCatalog,
  manifest,
  { professionId: "engineer" },
);
