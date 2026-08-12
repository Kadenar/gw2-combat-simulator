import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { engineerCatalog } from "../catalog.js";
import type { CatalogEntity } from "../../../platform/engine/types.js";

const IMPLEMENTED = new Set([
  "Explosive Entrance",
  "Grenadier",
  "Short Fuse",
  "Steel-Packed Powder",
  "Glass Cannon",
  "Shaped Charge",
  "Aim-Assisted Rocket",
  "Explosive Temper",
  "Shrapnel",
  "Blast Shield",
  "Grand Entrance",
  "Big Boomer",
  "Compounding Chemicals",
  "Energy Amplifier",
  "Optimized Activation",
  "Static Discharge",
  "Power Wrench",
  "Streamlined Kits",
  "Takedown Round",
  "Excessive Energy",
  "Kinetic Battery",
  "Adrenal Implant",
  "Gadgeteer",
  "Serrated Steel",
  "Hematic Focus",
  "Chemical Rounds",
  "Sanguine Array",
  "High Caliber",
  "Thermal Vision",
  "No Scope",
  "Modified Ammunition",
  "Heavy Metal",
  "Sharpshooter",
  "Incendiary Powder",
  "Speed of Synergy",
  "Gyroscopic Acceleration",
  "System Shocker",
  "Mass Momentum",
  "Object in Motion",
  "Ex Machina",
  "Kinetic Accelerators",
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
  "Light Density Amplifier",
  "Solar Focusing Lens",
  "Thermal Release Valve",
  "Enhanced Capacity Storage Unit",
  "Photonic Blasting Module",
  "Crystal Configuration: Storm",
  "Photon Projector",
  "Function Gyro",
  "Mechanical Genius",
  "Willing Host",
  "Hardened Chrome",
  "Carbolic Composition",
  "Mercurial Tendencies",
  "Silver Lining",
  "New Genes",
  "Symbiotic Synergy",
  "Double Helix",
  "Experimental Union",
  "Hybrid Vigor",
]);

const OUT_OF_MODEL_REASONS = Object.freeze({
  defensive:
    "Incoming-hit, barrier, healing, condition-cleansing, and damage-reduction effects are outside the outgoing single-target damage model.",
  ally: "Ally-only support, revival, and area boon delivery are outside the single-player target model.",
  movement:
    "Movement speed, evade mobility, and downed-state behavior are not represented by the stationary PvE target model.",
  random:
    "Random proc selection is not resolved without an explicit deterministic-choice contract and authoritative proc packet data.",
  missingMechanics:
    "The API presentation text lacks the numeric coefficient, duration, threshold, or proc cadence required for deterministic simulation evidence.",
});

function outOfModelReason(trait: CatalogEntity): string {
  const description = String(trait.description || "").toLowerCase();
  if (/ally|allies|reviv|nearby/.test(description)) {
    return OUT_OF_MODEL_REASONS.ally;
  }
  if (
    /heal|barrier|incoming|block|damage reduction|condition.*remove/.test(
      description,
    )
  ) {
    return OUT_OF_MODEL_REASONS.defensive;
  }
  if (/movement|swiftness|superspeed|downed/.test(description)) {
    return OUT_OF_MODEL_REASONS.movement;
  }
  if (/chance|random/.test(description)) {
    return OUT_OF_MODEL_REASONS.random;
  }
  return OUT_OF_MODEL_REASONS.missingMechanics;
}

function implementedEvidence(trait: CatalogEntity): {
  readonly file: string;
  readonly name: string;
} {
  if (
    [
      "Chemical Rounds",
      "Thermal Vision",
      "Compounding Chemicals",
      "Hybrid Vigor",
    ].includes(trait.name)
  ) {
    return {
      file: "tests/professions/native-build-attributes.test.js",
      name: "Engineer exposes current unconditional trait attributes",
    };
  }
  if (trait.specialization === "Mechanist") {
    return {
      file: "tests/professions/engineer/engineer.test.js",
      name: "Mechanist commands are selected by traits and mech attacks persist",
    };
  }
  if (trait.specialization === "Holosmith") {
    return {
      file: "tests/professions/engineer/engineer.test.js",
      name: "Photon Forge overheats at its trait-adjusted maximum",
    };
  }
  if (trait.specialization === "Amalgam") {
    return {
      file: "tests/professions/engineer/engineer.test.js",
      name: "benchmark Amalgam traits activate on morph and Evolve chronology",
    };
  }
  return {
    file: "tests/professions/engineer/engineer.test.js",
    name: "benchmark Explosives and Firearms traits materialize offensive effects",
  };
}

const manifest = engineerCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  const description =
    String(trait.description || "").trim() ||
    `Reviewed passive or utility behavior for ${trait.name}.`;
  const reason = outOfModelReason(trait);
  return {
    traitId: trait.id,
    status,
    effects: [
      {
        description,
        status,
        ...(implemented
          ? {}
          : {
              reason,
            }),
      },
    ],
    ...(implemented
      ? {
          tests: [implementedEvidence(trait)],
        }
      : {
          reason,
        }),
  };
});

export const ENGINEER_TRAIT_COVERAGE = validateTraitCoverageManifest(
  engineerCatalog,
  manifest,
  { professionId: "engineer" },
);
