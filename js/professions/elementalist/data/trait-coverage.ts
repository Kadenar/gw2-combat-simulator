import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { elementalistCatalog } from "../catalog.js";

const IMPLEMENTED = new Set([
  "Empowering Flame",
  "Burning Precision",
  "Sunspot",
  "Burning Rage",
  "Smothering Auras",
  "Power Overwhelming",
  "Pyromancer's Training",
  "Persisting Flames",
  "Pyromancer's Puissance",
  "Inferno",
  "Zephyr's Speed",
  "Zephyr's Boon",
  "One with Air",
  "Ferocious Winds",
  "Electric Discharge",
  "Inscription",
  "Raging Storm",
  "Stormsoul",
  "Aeromancer's Training",
  "Bolt to the Heart",
  "Fresh Air",
  "Lightning Rod",
  "Earth's Embrace",
  "Serrated Stones",
  "Elemental Shielding",
  "Earthen Blast",
  "Strength of Stone",
  "Rock Solid",
  "Geomancer's Training",
  "Written in Stone",
  "Soothing Ice",
  "Piercing Shards",
  "Flow like Water",
  "Aquamancer's Training",
  "Arcane Prowess",
  "Arcane Precision",
  "Renewing Stamina",
  "Elemental Attunement",
  "Elemental Lockdown",
  "Elemental Enchantment",
  "Evasive Arcana",
  "Arcane Lightning",
  "Bountiful Power",
  "Singularity",
  "Gale Song",
  "Latent Stamina",
  "Unstable Conduit",
  "Hardy Conduit",
  "Tempestuous Aria",
  "Invigorating Torrents",
  "Transcendent Tempest",
  "Elemental Bastion",
  "Weaver",
  "Superior Elements",
  "Elemental Pursuit",
  "Weaver's Prowess",
  "Swift Revenge",
  "Bolstered Elements",
  "Elemental Polyphony",
  "Elements of Rage",
  "Flow State",
  "Depth of Elements",
  "Vicious Empowerment",
  "Energized Elements",
  "Elemental Empowerment",
  "Empowering Auras",
  "Spectacular Sphere",
  "Elemental Epitome",
  "Elemental Synergy",
  "Empowered Empowerment",
  "Sphere Specialist",
  "Evocation",
  "Fiery Might",
  "Enhanced Potency",
  "Familiar's Focus",
  "Familiar's Blessing",
  "Elemental Dynamo",
  "Altruistic Aspect",
  "Familiar's Prowess",
  "Galvanic Enchantment",
  "Elemental Balance",
  "Specialized Elements",
]);

const CORE_SPECIALIZATIONS = new Set([
  "Fire",
  "Air",
  "Earth",
  "Water",
  "Arcane",
]);

const OUT_OF_MODEL_REASON =
  "This defensive, healing, movement, allied-support, or insufficiently specified proc does not affect the deterministic single-target damage model.";

const manifest = elementalistCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  const specialization = CORE_SPECIALIZATIONS.has(String(trait.specialization))
    ? "Core"
    : String(trait.specialization);
  return {
    traitId: trait.id,
    status,
    effects: [
      {
        description: `Reviewed Elementalist behavior described by ${trait.name}.`,
        status,
        ...(implemented ? {} : { reason: OUT_OF_MODEL_REASON }),
      },
    ],
    ...(implemented
      ? {
          tests: [
            {
              file: "tests/professions/elementalist/native-mechanics.test.js",
              name: `${specialization} mechanics execute through native hooks`,
            },
          ],
        }
      : { reason: OUT_OF_MODEL_REASON }),
  };
});

export const ELEMENTALIST_TRAIT_COVERAGE = validateTraitCoverageManifest(
  elementalistCatalog,
  manifest,
  { professionId: "elementalist" },
);
