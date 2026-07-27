import { SKILLS, SPECIALIZATIONS } from "./data/mesmer-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import {
  MESMER_EXTRA_SKILLS,
  MESMER_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import { createCanonicalCatalog } from "../../platform/engine/catalog.js";

const generated = SKILLS.map((skill) => ({
  ...skill,
  implemented: false,
  effects: [],
}));

// Ammo-flip mantras (e.g. Mantra of Pain) store their charges on the armed
// flip child (Power Spike), which we model with armedAtStart + ammo. The GW2
// API metadata instead puts ammo on the parent container, so strip it from any
// parent whose modeled flip child carries ammo — otherwise both the scheduler
// (maximumAmmoFor) and palette treat the parent as a phantom charge skill.
const flipParentsWithAmmoChild = new Set(
  [...Object.values(MESMER_SKILL_MECHANICS), ...MESMER_EXTRA_SKILLS]
    .filter((skill) => skill.flipParent && Number(skill.ammo || 0) > 0)
    .map((skill) => skill.flipParent),
);
const overrides = Object.fromEntries(
  generated
    .filter((skill) => flipParentsWithAmmoChild.has(skill.name))
    .map((skill) => [skill.id, { ammo: 0, ammoRecharge: 0 }]),
);

export const mesmerCatalog = createCanonicalCatalog({
  generated,
  mechanics: MESMER_SKILL_MECHANICS,
  overrides,
  extraSkills: MESMER_EXTRA_SKILLS,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  // Preserve the original Mesmer name-based compatibility lookup while
  // normalized rotations continue migrating toward stable skill ids.
  skillNameCollision: "last",
  weapons: [
    "Axe",
    "Dagger",
    "Focus",
    "Greatsword",
    "Pistol",
    "Rifle",
    "Scepter",
    "Shield",
    "Spear",
    "Staff",
    "Sword",
    "Torch",
    "Trident",
  ],
  weaponHands: {
    Axe: "mh",
    Dagger: "mh",
    Focus: "oh",
    Greatsword: "2h",
    Pistol: "oh",
    Rifle: "2h",
    Scepter: "mh",
    Shield: "oh",
    Spear: "2h",
    Staff: "2h",
    Sword: "mh+oh",
    Torch: "oh",
    Trident: "2h",
  },
});

export const MESMER_SKILLS = mesmerCatalog.skills;
