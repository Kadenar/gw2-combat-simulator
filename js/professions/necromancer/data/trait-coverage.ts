import {
  TRAIT_COVERAGE_STATUSES,
  validateTraitCoverageManifest,
} from "../../../platform/gw2/trait-coverage.js";
import { necromancerCatalog } from "../catalog.js";
import type { CatalogEntity } from "../../../platform/engine/types.js";

const IMPLEMENTED = new Set([
  "Reaper's Might",
  "Awaken the Pain",
  "Siphoned Power",
  "Spiteful Talisman",
  "Malicious Swarm",
  "Bitter Chill",
  "Chill of Death",
  "Spiteful Fortitude",
  "Signets of Suffering",
  "Dread",
  "Close to Death",
  "Spiteful Spirit",
  "Barbed Precision",
  "Furious Demise",
  "Target the Weak",
  "Insidious Disruption",
  "Plague Sending",
  "Chilling Darkness",
  "Master of Corruption",
  "Weakening Shroud",
  "Terror",
  "Lingering Curse",
  "Armored Shroud",
  "Soul Comprehension",
  "Flesh of the Master",
  "Putrid Defense",
  "Shrouded Removal",
  "Necromantic Corruption",
  "Dark Defense",
  "Deadly Strength",
  "Corrupter's Fervor",
  "Overflowing Thirst",
  "Vampiric Presence",
  "Transfusion",
  "Gluttony",
  "Sinister Shroud",
  "Soul Battery",
  "Unyielding Blast",
  "Soul Marks",
  "Speed of Shadows",
  "Soul Barbs",
  "Vital Persistence",
  "Alchemic Vigor",
  "Fear of Death",
  "Eternal Life",
  "Death Perception",
  "Dhuumfire",
  "Shroud Knight",
  "Shivers of Dread",
  "Cold Shoulder",
  "Augury of Death",
  "Chilling Nova",
  "Soul Eater",
  "Chilling Victory",
  "Decimate Defenses",
  "Blighter's Boon",
  "Deathly Chill",
  "Reaper's Onslaught",
  "Mantle of Sand",
  "Sand Sage",
  "Abrasive Grit",
  "Fell Beacon",
  "Nourishing Ashes",
  "Sadistic Searing",
  "Herald of Sorrow",
  "Sand Savant",
  "Demonic Lore",
  "Desert Empowerment",
  "Dark Disciple",
  "Corrupted Talent",
  "Wicked Corruption",
  "Bolstering Brew",
  "Septic Corruption",
  "Implacable Foe",
  "Twisted Medicine",
  "Dark Gunslinger",
  "Cascading Corruption",
  "Deathly Haste",
  "Doom Approaches",
  "Spawning Power",
  "Boon of Creation",
  "Charged Souls",
  "Explosive Growth",
  "Empowering Spirits",
  "Spirit's Strength",
  "Wielder's Boon",
  "Lingering Spirits",
  "Soul Twisting",
]);

const OUT_OF_MODEL_REASON_BY_NAME: Readonly<Record<string, string>> =
  Object.freeze({
    "Path of Corruption":
      "Enemy boon identities and boon-to-condition conversion are not represented by the configured single-target state.",
    "Parasitic Contagion":
      "Player healing and incoming damage are outside the outgoing single-target damage model.",
    "Beyond the Veil":
      "Incoming condition damage and player damage reduction are outside the outgoing damage model.",
    "Death Nova":
      "Player downing, enemy kills, and uncontrolled minion deaths are not represented by the deterministic encounter model.",
    "Unholy Sanctuary":
      "Player healing and lethal incoming damage are outside the outgoing single-target damage model.",
    "Mark of Evasion":
      "The Necromancer rotation contract has no dodge action or movement-position model from which to trigger this mark.",
    Vampiric:
      "The catalog does not provide the per-hit PvE siphon coefficient and player healing is outside the result model.",
    "Last Rites":
      "Ally downed state, player health loss, and healing output are outside the single-player damage model.",
    "Ritual of Life":
      "Ally revival and area healing are outside the single-player target model.",
    "Blood Renewal":
      "Player healing and defensive self-condition consumption are outside the outgoing damage model.",
    "Life from Death":
      "Ally healing on shroud exit is outside the single-player target model.",
    "Banshee's Wail":
      "The API metadata does not provide the authoritative PvE effect-duration increase needed to alter Warhorn pulses deterministically.",
    "Blood Bank":
      "Player healing, overheal, and personal barrier are outside the outgoing damage model.",
    "Unholy Martyr":
      "Ally condition transfer and player defensive condition consumption are outside the single-player target model.",
    "Relentless Pursuit":
      "Incoming movement-impairing condition duration is outside the stationary outgoing damage model.",
    "Blood as Sand":
      "Incoming player damage reduction is outside the outgoing single-target damage model.",
    "Feed from Corruption":
      "Enemy boon removal and personal barrier are outside the configured target and incoming-damage model.",
    "Wandering Spirits":
      "Spirit pathing and player-relative teleport positioning are outside the stationary target model.",
    "Spirit's Gift":
      "Ally healing on creature summons is outside the single-player target model.",
    "Spirits' Remedy":
      "Ally condition removal on creature summons is outside the single-player target model.",
  });

const EVIDENCE_BY_SPECIALIZATION: Readonly<Record<string, string>> =
  Object.freeze({
    Spite: "cross-specialization Necromancer trait triggers remain executable",
    Curses: "requested Harbinger damage traits apply at their per-hit triggers",
    "Death Magic":
      "remaining outgoing Necromancer trait families affect combat state",
    "Blood Magic":
      "cross-specialization Necromancer trait triggers remain executable",
    "Soul Reaping":
      "signet passives and Soul Battery are profession-owned resources",
    Reaper:
      "Reaper traits reduce shroud cooldowns and ignore minion critical hits",
    Scourge:
      "Scourge barrier, shroud, and greater-shade traits trigger precisely",
    Harbinger:
      "current Harbinger grandmaster traits use their live PvE mechanics",
    Ritualist:
      "Ritualist live spirit packets retain independent ownership and cadence",
  });

const EVIDENCE_BY_TRAIT: Readonly<Record<string, string>> = Object.freeze({
  "Barbed Precision":
    "Barbed Precision uses centered deterministic expected procs",
  "Lingering Curse":
    "Lingering Curse increases scepter base duration beyond the stat cap",
  "Master of Corruption":
    "Blood Is Power and Plague Signet preserve transferred conditions",
  "Plague Sending": "Plague Sending treats Scourge F5 as entering shroud",
  Dhuumfire: "Dhuumfire uses the specialization duration split and Scourge ICD",
  "Soul Barbs":
    "Soul Barbs and Dark Gunslinger change their documented outputs",
  "Dark Gunslinger":
    "Soul Barbs and Dark Gunslinger change their documented outputs",
  "Corrupted Talent":
    "Corrupted Talent owns the Harbinger shroud-entry life-force gain",
  "Death Perception":
    "the Power Harbinger trait set uses current critical and resource rules",
  "Wicked Corruption":
    "the Power Harbinger trait set uses current critical and resource rules",
  "Implacable Foe":
    "the Power Harbinger trait set uses current critical and resource rules",
  "Shroud Knight": "Reaper Shroud enforces its chain and four-percent drain",
  "Mantle of Sand": "Scourge shades use ammo and shade skills spend life force",
  "Dark Disciple": "Harbinger Shroud generates and consumes expiring blight",
  "Spawning Power":
    "Ritualist spirits attack, empower Essence Blast, and innervate",
  "Charged Souls":
    "Ritualist spirits attack, empower Essence Blast, and innervate",
  "Lingering Spirits":
    "Ritualist spirits attack, empower Essence Blast, and innervate",
});

function implementedEvidence(trait: CatalogEntity) {
  return {
    file: "tests/professions/necromancer/necromancer.test.js",
    name:
      EVIDENCE_BY_TRAIT[trait.name] ||
      EVIDENCE_BY_SPECIALIZATION[String(trait.specialization || "")],
  };
}

const manifest = necromancerCatalog.traits.map((trait) => {
  const implemented = IMPLEMENTED.has(trait.name);
  const status = implemented
    ? TRAIT_COVERAGE_STATUSES.IMPLEMENTED
    : TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL;
  const reason = OUT_OF_MODEL_REASON_BY_NAME[trait.name];
  if (!implemented && !reason) {
    throw new TypeError(
      `Necromancer trait ${trait.name} needs an explicit coverage reason.`,
    );
  }
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
    ...(implemented ? { tests: [implementedEvidence(trait)] } : { reason }),
  };
});

export const NECROMANCER_TRAIT_COVERAGE = validateTraitCoverageManifest(
  necromancerCatalog,
  manifest,
  { professionId: "necromancer" },
);
