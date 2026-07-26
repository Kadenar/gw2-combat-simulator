import {
  SKILLS,
  SPECIALIZATIONS,
} from "./data/mesmer-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import {
  MESMER_EXTRA_SKILLS,
  MESMER_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import {
  createCanonicalCatalog,
} from "../../platform/engine/catalog.js";

const generated = SKILLS.map(skill => ({
  ...skill,
  implemented: false,
  effects: [],
}));
export const mesmerCatalog = createCanonicalCatalog({
  generated,
  mechanics: MESMER_SKILL_MECHANICS,
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
