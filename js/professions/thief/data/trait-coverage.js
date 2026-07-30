import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { thiefCatalog } from "../catalog.js";

const IMPLEMENTED = new Set([
  "Serpent's Touch",
  "Exposed Weakness",
  "Dagger Training",
  "Deadly Ambition",
  "Even the Odds",
  "Revealed Training",
  "Executioner",
  "Ferocious Strikes",
  "Signets of Power",
  "Twin Fangs",
  "Sundering Shade",
  "Practiced Tolerance",
  "Deadly Aim",
  "No Quarter",
  "Shadow's Rejuvenation",
  "Hidden Thief",
  "Kleptomaniac",
  "Preparedness",
  "Lead Attacks",
  "Quick Pockets",
  "Deadly Ambush",
  "Upper Hand",
  "Marauder's Resilience",
  "Staff Master",
  "Weakening Strikes",
  "Havoc Specialist",
  "Endurance Thief",
  "Brawler's Tenacity",
  "Physical Supremacy",
  "Lotus Training",
  "Unhindered Combatant",
  "Bounding Dodger",
  "Iron Sight",
  "Deadeye's Gaze",
  "Malicious Intent",
  "Silent Scope",
  "Premeditation",
  "Maleficent Seven",
  "Second Opinion",
  "Specter",
  "Amplified Siphoning",
  "Strength of Shadows",
  "Enterprising Aristocrat",
  "Trinket Collector",
  "Prolific Plunderer",
  "Scoundrel's Luck",
  "Exhilarating Ephemera",
  "Prodigious Pincher",
  "Combat High",
]);
const reason =
  "This healing, barrier, ally-only, movement, incoming-hit, defensive, revival, or competitive-only effect does not change the deterministic single-target damage model.";

const EVIDENCE_BY_SPECIALIZATION = Object.freeze({
  Daredevil: "Daredevil capacity and every dodge replacement resolve explicitly",
  Deadeye: "Deadeye Mark grants malice once per initiative skill use",
  Specter: "Specter Siphon, initiative spending, and Shadow Shroud share force",
  Antiquary: "Antiquary artifacts, Reshuffle, Double Edge, and summons are deterministic",
});

function implementedEvidence(trait) {
  const specializationTest =
    EVIDENCE_BY_SPECIALIZATION[trait.specialization];
  return specializationTest
    ? { file: "tests/thief.test.js", name: specializationTest }
    : {
        file: "tests/native-build-attributes.test.js",
        name: "Thief uses current flat trait and conversion values",
      };
}

const manifest = thiefCatalog.traits.map(trait => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  return {
    traitId: trait.id,
    status,
    effects: [{
      description: String(trait.description || "").trim()
        || `Reviewed combat behavior for ${trait.name}.`,
      status,
      ...(implemented ? {} : { reason }),
    }],
    ...(implemented
      ? { tests: [implementedEvidence(trait)] }
      : { reason }),
  };
});

export const THIEF_TRAIT_COVERAGE = validateTraitCoverageManifest(
  thiefCatalog,
  manifest,
  { professionId: "thief" },
);
