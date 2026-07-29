import { SKILLS, SPECIALIZATIONS } from "./data/mesmer-api-metadata.js";
import {
  MESMER_SUPPLEMENTAL_SKILLS,
} from "./data/mesmer-supplemental-skills.js";
import {
  defaultMesmerLegacySkillId,
  MESMER_DUPLICATE_SKILL_NAMES,
} from "./data/legacy-skill-resolver.js";
import { TRAITS } from "./data/traits-data.js";
import {
  MESMER_EXTRA_SKILLS,
  MESMER_SKILL_MECHANICS,
  MESMER_SUPPLEMENTAL_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import {
  MESMER_FLIP_PARENT_BY_CHILD_ID,
  prepareMesmerSkillForCatalog,
} from "./mechanics/handler-mechanics.js";
import {
  mesmerSkillHandlers,
} from "./mechanics/specific/handlers.js";
import { createCanonicalCatalog } from "../../platform/engine/catalog.js";

const generated = [...SKILLS, ...MESMER_SUPPLEMENTAL_SKILLS].map((skill) => ({
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
  Object.entries(MESMER_SUPPLEMENTAL_SKILL_MECHANICS)
    .filter(([, skill]) => Number(skill.ammo || 0) > 0)
    .map(([id]) => MESMER_FLIP_PARENT_BY_CHILD_ID[Number(id)])
    .filter(Boolean),
);
const overrides = Object.fromEntries(
  generated
    .filter((skill) => flipParentsWithAmmoChild.has(skill.id))
    .map((skill) => [skill.id, { ammo: 0, ammoRecharge: 0 }]),
);

export const mesmerCatalog = createCanonicalCatalog({
  generated,
  mechanics: Object.fromEntries(
    Object.entries({
      ...MESMER_SKILL_MECHANICS,
      ...MESMER_SUPPLEMENTAL_SKILL_MECHANICS,
    }).map(([id, skill]) => [
      id,
      prepareMesmerSkillForCatalog({ id: Number(id), ...skill }),
    ]),
  ),
  overrides,
  extraSkills: MESMER_EXTRA_SKILLS.map(prepareMesmerSkillForCatalog),
  skillHandlers: mesmerSkillHandlers,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  skillNameCollision: "first",
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
  },
});

// The generic catalog map remains a presentation/legacy boundary. Duplicate
// defaults are selected explicitly instead of depending on insertion order;
// persisted builds use the specialization-aware resolver in build.js.
for (const name of MESMER_DUPLICATE_SKILL_NAMES) {
  const skill = mesmerCatalog.skillsById.get(defaultMesmerLegacySkillId(name));
  if (skill) mesmerCatalog.skillsByName.set(name, skill);
}

export const MESMER_SKILLS = mesmerCatalog.skills;
