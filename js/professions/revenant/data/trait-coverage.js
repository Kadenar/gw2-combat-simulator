import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { revenantCatalog } from "../catalog.js";

const IMPLEMENTED = new Set([
  "Ferocious Aggression",
  "Rising Tide",
  "Notoriety",
  "Roiling Mists",
  "Charged Mists",
  "Pact of Pain",
  "Abyssal Chill",
  "Replenishing Despair",
  "Hardening Persistence",
  "Righteous Rebel",
  "Swift Termination",
  "Elevated Compassion",
]);
const reason =
  "This defensive, support, movement, healing, incoming-hit, or competitive-only effect does not change the deterministic single-target damage model.";
const manifest = revenantCatalog.traits.map(trait => {
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
      ? { tests: ["tests/revenant.test.js#trait-coverage"] }
      : { reason }),
  };
});
export const REVENANT_TRAIT_COVERAGE = validateTraitCoverageManifest(
  revenantCatalog,
  manifest,
  { professionId: "revenant" },
);

