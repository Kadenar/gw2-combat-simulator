import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { revenantCatalog } from "../catalog.js";

const IMPLEMENTED = new Set([
  "Ferocious Aggression",
  "Rising Tide",
  "Spirit Boon",
  "Song of the Mists",
  "Notoriety",
  "Roiling Mists",
  "Charged Mists",
  "Invoking Torment",
  "Seething Malice",
  "Yearning Empowerment",
  "Acolyte of Torment",
  "Pact of Pain",
  "Abyssal Chill",
  "Diabolic Inferno",
  "Dwarven Battle Training",
  "Vicious Reprisal",
  "Expose Defenses",
  "Destructive Impulses",
  "Targeted Destruction",
  "Unsuspecting Strikes",
  "Battle Scarred",
  "Assassin's Presence",
  "Thrill of Combat",
  "Brutality",
  "Dance of Death",
  "Replenishing Despair",
  "Hardening Persistence",
  "Ambush Commander",
  "Endless Enmity",
  "Brutal Momentum",
  "Blood Fury",
  "Heartpiercer",
  "All for One",
  "Vindication",
  "Lasting Legacy",
  "Righteous Rebel",
  "Swift Termination",
  "Reinforced Potency",
  "Elevated Compassion",
  "Tenacious Ruin",
  "Empire Divided",
  "Leviathan Strength",
  "Reaver's Curse",
  "Angsiyan's Trust",
  "Song of Arboreum",
  "Forerunner of Death",
  "Vassals of the Empire",
]);
const reason =
  "This defensive, support, movement, healing, incoming-hit, or competitive-only effect does not change the deterministic single-target damage model.";
const EVIDENCE_BY_SPECIALIZATION = Object.freeze({
  Invocation: "legend invocation traits resolve after swap effects",
  Corruption: "Corruption traits update attributes, duration, and chill triggers",
  Retribution: "Retribution and Invocation traits use live combat state",
  Devastation: "Devastation modifiers and Battle Scars use supplied thresholds",
  Herald: "Herald consume skills apply their full outgoing profiles",
  Renegade: "Kalla's Fervor stacks, refreshes, and improves with Lasting Legacy",
  Vindicator: "Vindicator dodge traits apply current endurance and damage behavior",
  Conduit: "Conduit grandmasters alter release, invocation, and Cosmic Wisdom",
});
function implementedEvidence(trait) {
  return {
    file: "tests/revenant.test.js",
    name:
      EVIDENCE_BY_SPECIALIZATION[trait.specialization]
      || "Retribution and Invocation traits use live combat state",
  };
}
const manifest = revenantCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
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
        ...(implemented ? {} : { reason }),
      },
    ],
    ...(implemented
      ? { tests: [implementedEvidence(trait)] }
      : { reason }),
  };
});
export const REVENANT_TRAIT_COVERAGE = validateTraitCoverageManifest(
  revenantCatalog,
  manifest,
  { professionId: "revenant" },
);
