import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { elementalistCatalog } from "../catalog.js";
import type { CatalogEntity } from "../../../platform/engine/types.js";

const IMPLEMENTED = new Set([
  "Empowering Flame",
  "Burning Precision",
  "Conjurer",
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
  "Gathered Focus",
  "Hardy Conduit",
  "Tempestuous Aria",
  "Harmonious Conduit",
  "Invigorating Torrents",
  "Transcendent Tempest",
  "Lucid Singularity",
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

const TEST_FILE = "tests/professions/elementalist/native-mechanics.test.js";

const EVIDENCE_GROUPS: readonly {
  readonly name: string;
  readonly traits: readonly string[];
}[] = Object.freeze([
  {
    name: "core damage traits expose their exact resolver modifiers",
    traits: [
      "Empowering Flame",
      "Burning Rage",
      "Power Overwhelming",
      "Pyromancer's Training",
      "Persisting Flames",
      "Inferno",
      "Zephyr's Speed",
      "Ferocious Winds",
      "Stormsoul",
      "Aeromancer's Training",
      "Bolt to the Heart",
      "Serrated Stones",
      "Strength of Stone",
      "Geomancer's Training",
      "Piercing Shards",
      "Flow like Water",
      "Aquamancer's Training",
      "Arcane Lightning",
      "Bountiful Power",
    ],
  },
  {
    name: "core attunement and aura traits emit named boon and damage payloads",
    traits: [
      "Conjurer",
      "Sunspot",
      "Smothering Auras",
      "Pyromancer's Puissance",
      "Zephyr's Boon",
      "One with Air",
      "Electric Discharge",
      "Inscription",
      "Earth's Embrace",
      "Elemental Shielding",
      "Earthen Blast",
      "Rock Solid",
      "Written in Stone",
      "Soothing Ice",
      "Arcane Prowess",
      "Elemental Attunement",
    ],
  },
  {
    name: "core critical-hit and control traits enforce their proc rules",
    traits: [
      "Burning Precision",
      "Raging Storm",
      "Lightning Rod",
      "Arcane Precision",
      "Renewing Stamina",
      "Elemental Lockdown",
    ],
  },
  {
    name: "Fresh Air resets both Air Attunement and Overload Air",
    traits: ["Fresh Air"],
  },
  {
    name: "core attunements enforce and report their individual recharge",
    traits: ["Elemental Enchantment"],
  },
  {
    name: "Evasive Arcana uses the active attunement's native trait skill",
    traits: ["Evasive Arcana"],
  },
  {
    name: "Tempest traits enforce overload dwell, auras, boons, and damage windows",
    traits: [
      "Singularity",
      "Gale Song",
      "Latent Stamina",
      "Unstable Conduit",
      "Gathered Focus",
      "Hardy Conduit",
      "Tempestuous Aria",
      "Harmonious Conduit",
      "Invigorating Torrents",
      "Transcendent Tempest",
      "Elemental Bastion",
    ],
  },
  {
    name: "Alacrity shortens overload dwell and Lucid Singularity follows hit timing",
    traits: ["Lucid Singularity"],
  },
  {
    name: "Weaver traits enforce dual-attunement, boon, modifier, and recharge rules",
    traits: [
      "Weaver",
      "Superior Elements",
      "Elemental Pursuit",
      "Weaver's Prowess",
      "Swift Revenge",
      "Bolstered Elements",
      "Elemental Polyphony",
      "Elements of Rage",
      "Flow State",
    ],
  },
  {
    name: "Catalyst traits enforce energy, empowerment, aura, and sphere rules",
    traits: [
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
    ],
  },
  {
    name: "Evoker traits enforce familiar boons, enchantments, and charge rules",
    traits: [
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
    ],
  },
  {
    name: "Specialized Elements forces and locks the selected attunement",
    traits: ["Specialized Elements"],
  },
]);

const EVIDENCE_BY_TRAIT = new Map(
  EVIDENCE_GROUPS.flatMap((group) =>
    group.traits.map((trait) => [trait, group.name] as const),
  ),
);

function implementedEvidence(trait: CatalogEntity) {
  const name = EVIDENCE_BY_TRAIT.get(trait.name);
  if (!name) {
    throw new TypeError(
      `Implemented Elementalist trait ${trait.name} needs effect-specific evidence.`,
    );
  }
  return { file: TEST_FILE, name };
}

function outOfModelReason(trait: CatalogEntity): string {
  const description = String(trait.description || "").toLowerCase();
  if (/ally|allies|share|revive/.test(description)) {
    return "This allied or revival payload cannot change the simulator's deterministic single-target damage output.";
  }
  if (
    /heal|barrier|incoming damage|damage reduction|health/.test(description)
  ) {
    return "This healing, barrier, health, or incoming-damage payload is outside the deterministic outgoing-damage model.";
  }
  if (/cleanse|remove.*condition|condition.*remove|blind/.test(description)) {
    return "This defensive condition-management payload has no represented incoming-condition state or deterministic damage output.";
  }
  if (/movement|superspeed|swiftness|dodge/.test(description)) {
    return "This movement or defensive-evasion payload has no effect in the stationary deterministic target model.";
  }
  return "This catalog effect has no deterministic single-target damage, boon-uptime, recharge, or resource consequence in the native model.";
}

const manifest = elementalistCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  const reason = implemented ? "" : outOfModelReason(trait);
  return {
    traitId: trait.id,
    status,
    effects: [
      {
        description:
          String(trait.description || "").trim() ||
          `Reviewed deterministic combat behavior for ${trait.name}.`,
        status,
        ...(implemented ? {} : { reason }),
      },
    ],
    ...(implemented
      ? {
          tests: [implementedEvidence(trait)],
        }
      : { reason }),
  };
});

export const ELEMENTALIST_TRAIT_COVERAGE = validateTraitCoverageManifest(
  elementalistCatalog,
  manifest,
  { professionId: "elementalist" },
);
