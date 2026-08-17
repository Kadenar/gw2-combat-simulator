import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { guardianCatalog } from "../catalog.js";
import type { CatalogEntity } from "../../../platform/engine/types.js";

const IMPLEMENTED = new Set([
  "Zealot's Resolution",
  "Symbolic Exposure",
  "Symbolic Avenger",
  "Fiery Wrath",
  "Zealous Blade",
  "Kindled Zeal",
  "Eternal Armory",
  "Furious Focus",
  "Justice is Blind",
  "Radiant Power",
  "Right-Hand Strength",
  "Radiant Fire",
  "Retribution",
  "Amplified Wrath",
  "Perfect Inscriptions",
  "Righteous Instincts",
  "Focus Mastery",
  "Stalwart Defender",
  "Honorable Staff",
  "Force of Will",
  "Inspired Virtue",
  "Virtue of Resolution",
  "Unscathed Contender",
  "Master of Consecrations",
  "Inspiring Virtue",
  "Glacial Heart",
  "Power of the Virtuous",
  "Indomitable Courage",
  "Defender's Dogma",
  "Pure of Sight",
  "Hunter's Premonition",
  "Dulled Senses",
  "Soaring Devastation",
  "Hunter's Determination",
  "Zealot's Aggression",
  "Heavy Light",
  "Big Game Hunter",
  "Imbued Haste",
  "Searing Pact",
  "Power for Power",
  "Conceited Curate",
  "Restorative Virtues",
  "Lethal Tempo",
  "Phoenix Protocol",
  "Tyrant's Momentum",
  "Light's Gift",
  "Permeating Wrath",
  "Purity of Word",
  "Unrelenting Criticism",
  "Liberator's Vow",
  "Archivist of Whispers",
  "Swift Scholar",
  "Weighty Terms",
  "Stalwart Speed",
  "Legendary Lore",
  "Stoic Demeanor",
  "Loremaster",
  "Quickfire",
  "Sovereign of Light",
  "Radiant Armaments",
  "Empowered Armaments",
  "Illuminating Inspiration",
  "Master-at-Arms",
]);

const REASONS = Object.freeze({
  defensive:
    "Incoming-hit, block, healing, barrier, revival, and damage-reduction behavior is outside the outgoing single-target damage model.",
  ally: "Ally-only healing, boon delivery, and group support are outside the single-player target model.",
  movement:
    "Movement, mobility, and downed-state effects are not represented by the stationary PvE target model.",
  missingMechanics:
    "The API presentation text lacks the authoritative numeric coefficient, duration, threshold, or proc cadence required for deterministic simulation.",
});

/** @param {CatalogEntity} trait */
function outOfModelReason(trait: CatalogEntity): string {
  const description = String(trait.description || "").toLowerCase();
  if (/ally|allies|reviv|nearby/.test(description)) return REASONS.ally;
  if (/heal|barrier|incoming|block|damage reduction|aegis/.test(description)) {
    return REASONS.defensive;
  }
  if (/movement|dodge|downed/.test(description)) return REASONS.movement;
  return REASONS.missingMechanics;
}

/** @param {CatalogEntity} trait */
const manifest = guardianCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  const reason = outOfModelReason(trait);
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
    ...(implemented ? {} : { reason }),
  };
});

export const GUARDIAN_TRAIT_COVERAGE = validateTraitCoverageManifest(
  guardianCatalog,
  manifest,
  { professionId: "guardian" },
);
