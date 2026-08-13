// ─── GW2 Elementalist Trait Data ────────────────────────────────────────────
// Native trait metadata and simulator-specific attribute fields.
// stat fields: numbers (percentages as numbers, e.g. criticalChance: 5 = +5%)
// position: 0 = minor (always active when spec selected), 1/2/3 = major trait choices
import type {
  ElementalistBuildSpecialization,
  ElementalistTrait,
} from "../types.js";

export const SPECIALIZATIONS: readonly string[] = [
  "Fire",
  "Air",
  "Earth",
  "Water",
  "Arcane",
  "Tempest",
  "Weaver",
  "Catalyst",
  "Evoker",
];
export const ELITE_SPECS: ReadonlySet<string> = new Set([
  "Tempest",
  "Weaver",
  "Catalyst",
  "Evoker",
]);
export const CORE_SPECS: readonly string[] = [
  "Fire",
  "Air",
  "Earth",
  "Water",
  "Arcane",
];

// Default trait selections per spec (all major traits at position 1)
export const DEFAULT_TRAITS = "1-1-1";

export const TRAITS: readonly ElementalistTrait[] = [
  // ── Fire ─────────────────────────────────────────────────────────────────
  {
    tier: "Minor Adept",
    name: "Empowering Flame",
    specialization: "Fire",
    position: 0,
  },
  {
    tier: "Major Adept",
    name: "Burning Precision",
    specialization: "Fire",
    position: 1,
    burningDuration: 20,
  },
  {
    tier: "Major Adept",
    name: "Conjurer",
    specialization: "Fire",
    position: 2,
  },
  {
    tier: "Major Adept",
    name: "Burning Fire",
    specialization: "Fire",
    position: 3,
  },
  {
    tier: "Minor Master",
    name: "Sunspot",
    specialization: "Fire",
    position: 0,
  },
  {
    tier: "Major Master",
    name: "Burning Rage",
    specialization: "Fire",
    position: 1,
    conditionDamage: 180,
  },
  {
    tier: "Major Master",
    name: "Smothering Auras",
    specialization: "Fire",
    position: 2,
  },
  {
    tier: "Major Master",
    name: "Power Overwhelming",
    specialization: "Fire",
    position: 3,
  },
  {
    tier: "Minor Grandmaster",
    name: "Pyromancer's Training",
    specialization: "Fire",
    position: 0,
  },
  {
    tier: "Major Grandmaster",
    name: "Persisting Flames",
    specialization: "Fire",
    position: 1,
  },
  {
    tier: "Major Grandmaster",
    name: "Pyromancer's Puissance",
    specialization: "Fire",
    position: 2,
  },
  {
    tier: "Major Grandmaster",
    name: "Inferno",
    specialization: "Fire",
    position: 3,
  },

  // ── Air ──────────────────────────────────────────────────────────────────
  {
    tier: "Minor Adept",
    name: "Zephyr's Speed",
    specialization: "Air",
    position: 0,
    criticalChance: 5,
  },
  {
    tier: "Major Adept",
    name: "Zephyr's Boon",
    specialization: "Air",
    position: 1,
  },
  {
    tier: "Major Adept",
    name: "One with Air",
    specialization: "Air",
    position: 2,
  },
  {
    tier: "Major Adept",
    name: "Ferocious Winds",
    specialization: "Air",
    position: 3,
  },
  {
    tier: "Minor Master",
    name: "Electric Discharge",
    specialization: "Air",
    position: 0,
  },
  {
    tier: "Major Master",
    name: "Inscription",
    specialization: "Air",
    position: 1,
  },
  {
    tier: "Major Master",
    name: "Raging Storm",
    specialization: "Air",
    position: 2,
  },
  {
    tier: "Major Master",
    name: "Stormsoul",
    specialization: "Air",
    position: 3,
  },
  {
    tier: "Minor Grandmaster",
    name: "Aeromancer's Training",
    specialization: "Air",
    position: 0,
    ferocity: 150,
  },
  {
    tier: "Major Grandmaster",
    name: "Bolt to the Heart",
    specialization: "Air",
    position: 1,
  },
  {
    tier: "Major Grandmaster",
    name: "Fresh Air",
    specialization: "Air",
    position: 2,
  },
  {
    tier: "Major Grandmaster",
    name: "Lightning Rod",
    specialization: "Air",
    position: 3,
  },

  // ── Earth ────────────────────────────────────────────────────────────────
  {
    tier: "Minor Adept",
    name: "Stone Flesh",
    specialization: "Earth",
    position: 0,
  },
  {
    tier: "Major Adept",
    name: "Earth's Embrace",
    specialization: "Earth",
    position: 1,
  },
  {
    tier: "Major Adept",
    name: "Serrated Stones",
    specialization: "Earth",
    position: 2,
    bleedingDuration: 20,
  },
  {
    tier: "Major Adept",
    name: "Elemental Shielding",
    specialization: "Earth",
    position: 3,
  },
  {
    tier: "Minor Master",
    name: "Earthen Blast",
    specialization: "Earth",
    position: 0,
  },
  {
    tier: "Major Master",
    name: "Strength of Stone",
    specialization: "Earth",
    position: 1,
  },
  {
    tier: "Major Master",
    name: "Rock Solid",
    specialization: "Earth",
    position: 2,
  },
  {
    tier: "Major Master",
    name: "Earthen Blessing",
    specialization: "Earth",
    position: 3,
  },
  {
    tier: "Minor Grandmaster",
    name: "Geomancer's Training",
    specialization: "Earth",
    position: 0,
  },
  {
    tier: "Major Grandmaster",
    name: "Diamond Skin",
    specialization: "Earth",
    position: 1,
  },
  {
    tier: "Major Grandmaster",
    name: "Written in Stone",
    specialization: "Earth",
    position: 2,
  },
  {
    tier: "Major Grandmaster",
    name: "Stone Heart",
    specialization: "Earth",
    position: 3,
  },

  // ── Water ────────────────────────────────────────────────────────────────
  {
    tier: "Minor Adept",
    name: "Soothing Mist",
    specialization: "Water",
    position: 0,
  },
  {
    tier: "Major Adept",
    name: "Soothing Ice",
    specialization: "Water",
    position: 1,
  },
  {
    tier: "Major Adept",
    name: "Piercing Shards",
    specialization: "Water",
    position: 2,
  },
  {
    tier: "Major Adept",
    name: "Stop, Drop, and Roll",
    specialization: "Water",
    position: 3,
  },
  {
    tier: "Minor Master",
    name: "Healing Ripple",
    specialization: "Water",
    position: 0,
  },
  {
    tier: "Major Master",
    name: "Soothing Disruption",
    specialization: "Water",
    position: 1,
  },
  {
    tier: "Major Master",
    name: "Cleansing Wave",
    specialization: "Water",
    position: 2,
  },
  {
    tier: "Major Master",
    name: "Flow like Water",
    specialization: "Water",
    position: 3,
  },
  {
    tier: "Minor Grandmaster",
    name: "Aquamancer's Training",
    specialization: "Water",
    position: 0,
  },
  {
    tier: "Major Grandmaster",
    name: "Cleansing Water",
    specialization: "Water",
    position: 1,
  },
  {
    tier: "Major Grandmaster",
    name: "Powerful Aura",
    specialization: "Water",
    position: 2,
  },
  {
    tier: "Major Grandmaster",
    name: "Soothing Power",
    specialization: "Water",
    position: 3,
    vitality: 300,
  },

  // ── Arcane ───────────────────────────────────────────────────────────────
  {
    tier: "Minor Adept",
    name: "Arcane Prowess",
    specialization: "Arcane",
    position: 0,
  },
  {
    tier: "Major Adept",
    name: "Arcane Precision",
    specialization: "Arcane",
    position: 1,
  },
  {
    tier: "Major Adept",
    name: "Renewing Stamina",
    specialization: "Arcane",
    position: 2,
  },
  {
    tier: "Major Adept",
    name: "Arcane Restoration",
    specialization: "Arcane",
    position: 3,
  },
  {
    tier: "Minor Master",
    name: "Elemental Attunement",
    specialization: "Arcane",
    position: 0,
  },
  {
    tier: "Major Master",
    name: "Arcane Resurrection",
    specialization: "Arcane",
    position: 1,
  },
  {
    tier: "Major Master",
    name: "Elemental Lockdown",
    specialization: "Arcane",
    position: 2,
  },
  {
    tier: "Major Master",
    name: "Final Shielding",
    specialization: "Arcane",
    position: 3,
  },
  {
    tier: "Minor Grandmaster",
    name: "Elemental Enchantment",
    specialization: "Arcane",
    position: 0,
    concentration: 180,
  },
  {
    tier: "Major Grandmaster",
    name: "Evasive Arcana",
    specialization: "Arcane",
    position: 1,
  },
  {
    tier: "Major Grandmaster",
    name: "Arcane Lightning",
    specialization: "Arcane",
    position: 2,
  },
  {
    tier: "Major Grandmaster",
    name: "Bountiful Power",
    specialization: "Arcane",
    position: 3,
  },

  // ── Tempest ──────────────────────────────────────────────────────────────
  {
    tier: "Minor Adept",
    name: "Singularity",
    specialization: "Tempest",
    position: 0,
  },
  {
    tier: "Major Adept",
    name: "Gale Song",
    specialization: "Tempest",
    position: 1,
  },
  {
    tier: "Major Adept",
    name: "Latent Stamina",
    specialization: "Tempest",
    position: 2,
  },
  {
    tier: "Major Adept",
    name: "Unstable Conduit",
    specialization: "Tempest",
    position: 3,
  },
  {
    tier: "Minor Master",
    name: "Gathered Focus",
    specialization: "Tempest",
    position: 0,
    concentration: 240,
  },
  {
    tier: "Major Master",
    name: "Tempestuous Aria",
    specialization: "Tempest",
    position: 1,
  },
  {
    tier: "Major Master",
    name: "Harmonious Conduit",
    specialization: "Tempest",
    position: 2,
  },
  {
    tier: "Major Master",
    name: "Invigorating Torrents",
    specialization: "Tempest",
    position: 3,
  },
  {
    tier: "Minor Grandmaster",
    name: "Hardy Conduit",
    specialization: "Tempest",
    position: 0,
  },
  {
    tier: "Major Grandmaster",
    name: "Transcendent Tempest",
    specialization: "Tempest",
    position: 1,
  },
  {
    tier: "Major Grandmaster",
    name: "Lucid Singularity",
    specialization: "Tempest",
    position: 2,
  },
  {
    tier: "Major Grandmaster",
    name: "Elemental Bastion",
    specialization: "Tempest",
    position: 3,
  },

  // ── Weaver ───────────────────────────────────────────────────────────────
  {
    tier: "Minor Adept",
    name: "Weaver",
    specialization: "Weaver",
    position: 0,
  },
  {
    tier: "Major Adept",
    name: "Superior Elements",
    specialization: "Weaver",
    position: 1,
  },
  {
    tier: "Major Adept",
    name: "Elemental Pursuit",
    specialization: "Weaver",
    position: 2,
  },
  {
    tier: "Major Adept",
    name: "Weaver's Prowess",
    specialization: "Weaver",
    position: 3,
  },
  {
    tier: "Minor Master",
    name: "Elemental Refreshment",
    specialization: "Weaver",
    position: 0,
    vitality: 200,
  },
  {
    tier: "Major Master",
    name: "Master's Fortitude",
    specialization: "Weaver",
    position: 1,
  },
  {
    tier: "Major Master",
    name: "Swift Revenge",
    specialization: "Weaver",
    position: 2,
  },
  {
    tier: "Major Master",
    name: "Bolstered Elements",
    specialization: "Weaver",
    position: 3,
  },
  {
    tier: "Minor Grandmaster",
    name: "Elemental Polyphony",
    specialization: "Weaver",
    position: 0,
  },
  {
    tier: "Major Grandmaster",
    name: "Elements of Rage",
    specialization: "Weaver",
    position: 1,
  },
  {
    tier: "Major Grandmaster",
    name: "Woven Stride",
    specialization: "Weaver",
    position: 2,
  },
  {
    tier: "Major Grandmaster",
    name: "Flow State",
    specialization: "Weaver",
    position: 3,
  },

  // ── Catalyst ─────────────────────────────────────────────────────────────
  {
    tier: "Minor Adept",
    name: "Depth of Elements",
    specialization: "Catalyst",
    position: 0,
  },
  {
    tier: "Major Adept",
    name: "Hardened Auras",
    specialization: "Catalyst",
    position: 1,
  },
  {
    tier: "Major Adept",
    name: "Vicious Empowerment",
    specialization: "Catalyst",
    position: 2,
  },
  {
    tier: "Major Adept",
    name: "Energized Elements",
    specialization: "Catalyst",
    position: 3,
  },
  {
    tier: "Minor Master",
    name: "Elemental Empowerment",
    specialization: "Catalyst",
    position: 0,
  },
  {
    tier: "Major Master",
    name: "Empowering Auras",
    specialization: "Catalyst",
    position: 1,
  },
  {
    tier: "Major Master",
    name: "Evasive Empowerment",
    specialization: "Catalyst",
    position: 2,
  },
  {
    tier: "Major Master",
    name: "Spectacular Sphere",
    specialization: "Catalyst",
    position: 3,
  },
  {
    tier: "Minor Grandmaster",
    name: "Elemental Epitome",
    specialization: "Catalyst",
    position: 0,
  },
  {
    tier: "Major Grandmaster",
    name: "Elemental Synergy",
    specialization: "Catalyst",
    position: 1,
  },
  {
    tier: "Major Grandmaster",
    name: "Empowered Empowerment",
    specialization: "Catalyst",
    position: 2,
  },
  {
    tier: "Major Grandmaster",
    name: "Sphere Specialist",
    specialization: "Catalyst",
    position: 3,
  },

  // ── Evoker ───────────────────────────────────────────────────────────────
  {
    tier: "Minor Adept",
    name: "Evocation",
    specialization: "Evoker",
    position: 0,
  },
  {
    tier: "Major Adept",
    name: "Fiery Might",
    specialization: "Evoker",
    position: 1,
  },
  {
    tier: "Major Adept",
    name: "Altruistic Aspect",
    specialization: "Evoker",
    position: 2,
  },
  {
    tier: "Major Adept",
    name: "Spirit's Succor",
    specialization: "Evoker",
    position: 3,
  },
  {
    tier: "Minor Master",
    name: "Enhanced Potency",
    specialization: "Evoker",
    position: 0,
  },
  {
    tier: "Major Master",
    name: "Familiar's Focus",
    specialization: "Evoker",
    position: 1,
  },
  {
    tier: "Major Master",
    name: "Familiar's Blessing",
    specialization: "Evoker",
    position: 2,
  },
  {
    tier: "Major Master",
    name: "Elemental Dynamo",
    specialization: "Evoker",
    position: 3,
  },
  {
    tier: "Minor Grandmaster",
    name: "Familiar's Prowess",
    specialization: "Evoker",
    position: 0,
  },
  {
    tier: "Major Grandmaster",
    name: "Galvanic Enchantment",
    specialization: "Evoker",
    position: 1,
  },
  {
    tier: "Major Grandmaster",
    name: "Elemental Balance",
    specialization: "Evoker",
    position: 2,
  },
  {
    tier: "Major Grandmaster",
    name: "Specialized Elements",
    specialization: "Evoker",
    position: 3,
  },
];

// ─── Resolve active traits from current spec selections ───────────────────────
// Returns all active trait objects (minor traits always, selected majors per tier).
export function getActiveTraits(
  specializations: readonly ElementalistBuildSpecialization[],
): ElementalistTrait[] {
  const active: ElementalistTrait[] = [];
  const majorTiers = ["Major Adept", "Major Master", "Major Grandmaster"];
  for (const spec of specializations) {
    const specTraits = TRAITS.filter((t) => t.specialization === spec.name);
    const picks = (spec.traits || "").split("-").map(Number);
    // Always include minor traits (position 0)
    for (const t of specTraits) {
      if (t.position === 0) active.push(t);
    }
    // Include selected major traits
    for (let i = 0; i < majorTiers.length; i++) {
      const pick = picks[i];
      if (!pick) continue;
      const major = specTraits.find(
        (t) => t.tier === majorTiers[i] && t.position === pick,
      );
      if (major) active.push(major);
    }
  }
  return active;
}
