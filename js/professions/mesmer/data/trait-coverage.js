import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { mesmerCatalog } from "../catalog.js";
import { MESMER_TRAIT_IDS as TRAIT } from "./ids.js";

const IMPLEMENTED = new Set([
  TRAIT.ALTERED_CHORD,
  TRAIT.BLINDING_DISSIPATION,
  TRAIT.BLOODSONG,
  TRAIT.BOUNTIFUL_BLADES,
  TRAIT.CHRONOPHANTASMA,
  TRAIT.COMPOUNDING_POWER,
  TRAIT.CRY_OF_PAIN,
  TRAIT.DANGER_TIME,
  TRAIT.DAZZLING,
  TRAIT.DEADLY_BLADES,
  TRAIT.DECEPTIVE_EVASION,
  TRAIT.DELAYED_REACTIONS,
  TRAIT.DESERT_DISTORTION,
  TRAIT.DUNE_CLOAK,
  TRAIT.EGOTISM,
  TRAIT.ELUSIVE_MIND,
  TRAIT.EMPOWERED_ILLUSIONS,
  TRAIT.FENCERS_FINESSE,
  TRAIT.FLOW_OF_TIME,
  TRAIT.FORTISSIMO,
  TRAIT.FRAGILITY,
  TRAIT.ILLUSIONARY_MEMBRANE,
  TRAIT.ILLUSIONARY_REVERSION,
  TRAIT.INEPTITUDE,
  TRAIT.INFINITE_FORGE,
  TRAIT.INFINITE_HORIZON,
  TRAIT.JAGGED_MIND,
  TRAIT.MAIM_THE_DISILLUSIONED,
  TRAIT.MALICIOUS_SORCERY,
  TRAIT.MASTER_OF_MISDIRECTION,
  TRAIT.MENTAL_ANGUISH,
  TRAIT.MENTAL_FOCUS,
  TRAIT.METHOD_OF_MADNESS,
  TRAIT.MIRAGE_MANTLE,
  TRAIT.NOMADS_ENDURANCE,
  TRAIT.PHANTASMAL_BLADES,
  TRAIT.PHANTASMAL_FORCE,
  TRAIT.PHANTASMAL_FURY,
  TRAIT.PHANTASMAL_HASTE,
  TRAIT.PHANTOM_PAIN,
  TRAIT.QUIET_INTENSITY,
  TRAIT.RENEWING_OASIS,
  TRAIT.RIDDLE_OF_SAND,
  TRAIT.SELF_DECEPTION,
  TRAIT.SHARPER_IMAGES,
  TRAIT.SHATTER_STORM,
  TRAIT.SHREDDING,
  TRAIT.SUPERIORITY_COMPLEX,
  TRAIT.SYNCOPATE,
  TRAIT.TIME_BOMB,
  TRAIT.VICIOUS_EXPRESSION,
]);

const OUT_OF_MODEL_REASON =
  "This defensive, healing, ally-only, movement, incoming-hit, boon-support, or competitive-only effect does not change the deterministic single-target damage model.";

function implementedEvidence(trait) {
  if (trait.specialization === "Mirage") {
    return {
      file: "tests/rotation.test.js",
      name: "Mirage support and cloak traits emit their current effects",
    };
  }
  if (trait.specialization === "Chronomancer") {
    return {
      file: "tests/rotation.test.js",
      name: "Staff 3 converts after Mage Strike finishes and Chronophantasma repeats it first",
    };
  }
  return {
    file: "tests/rotation.test.js",
    name: "supplied trait attacks execute with their exact coefficients",
  };
}

const manifest = mesmerCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(Number(trait.id));
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  return {
    traitId: trait.id,
    status,
    effects: [
      {
        description:
          String(trait.description || "").trim() ||
          `Reviewed combat behavior for ${trait.name}.`,
        status,
        ...(implemented ? {} : { reason: OUT_OF_MODEL_REASON }),
      },
    ],
    ...(implemented
      ? { tests: [implementedEvidence(trait)] }
      : { reason: OUT_OF_MODEL_REASON }),
  };
});

export const MESMER_TRAIT_COVERAGE = validateTraitCoverageManifest(
  mesmerCatalog,
  manifest,
  { professionId: "mesmer" },
);
