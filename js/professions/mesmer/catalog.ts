import { SKILLS, SPECIALIZATIONS } from "./data/mesmer-api-metadata.js";
import { MESMER_SUPPLEMENTAL_SKILLS } from "./data/mesmer-supplemental-skills.js";
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
import { MESMER_SKILL_IDS as ID } from "./data/ids.js";
import {
  MESMER_FLIP_PARENT_BY_CHILD_ID,
  prepareMesmerSkillForCatalog,
} from "./mechanics/handler-mechanics.js";
import { mesmerSkillHandlers } from "./handlers.js";
import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import type {
  ProfessionModuleCatalogFragment,
  Skill,
  SkillFragment,
  SkillId,
} from "../../platform/engine/types.js";

const generated: readonly Skill[] = [
  ...SKILLS,
  ...MESMER_SUPPLEMENTAL_SKILLS,
].map((skill) => ({
  ...skill,
  implemented: false,
  effects: [],
}));

// Ammo-flip mantras (e.g. Mantra of Pain) store their charges on the armed
// flip child (Power Spike), which we model with armedAtStart + ammo. The GW2
// API metadata instead puts ammo on the parent container, so strip it from any
// parent whose modeled flip child carries ammo — otherwise both the scheduler
// (maximumAmmoFor) and palette treat the parent as a phantom charge skill.
const flipParentsWithAmmoChild = new Set<number>(
  Object.entries(MESMER_SUPPLEMENTAL_SKILL_MECHANICS)
    .filter(([, skill]) => Number(skill.ammo || 0) > 0)
    .flatMap(([id]) => {
      const parentId = MESMER_FLIP_PARENT_BY_CHILD_ID[Number(id)];
      return parentId == null ? [] : [parentId];
    }),
);
const overrides: Readonly<Record<SkillId, SkillFragment>> = Object.fromEntries(
  generated
    .filter((skill) => flipParentsWithAmmoChild.has(Number(skill.id)))
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
      prepareMesmerSkillForCatalog({ ...skill, id: Number(id) }),
    ]),
  ),
  overrides,
  extraSkills: MESMER_EXTRA_SKILLS.map((skill) =>
    prepareMesmerSkillForCatalog({ ...skill, id: Number(skill.id) }),
  ),
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
  const defaultId = defaultMesmerLegacySkillId(name);
  const skill =
    defaultId == null ? undefined : mesmerCatalog.skillsById.get(defaultId);
  if (skill) {
    (mesmerCatalog.skillsByName as Map<string, Skill>).set(name, skill);
  }
}

export const MESMER_SKILLS = mesmerCatalog.skills;

export const MESMER_ELITE_SPECIALIZATIONS = Object.freeze([
  "Chronomancer",
  "Mirage",
  "Virtuoso",
  "Troubadour",
]);

const eliteSpecializations = new Set(MESMER_ELITE_SPECIALIZATIONS);
const coreRuntimeSkills = mesmerCatalog.skills.filter(
  (skill) =>
    skill.id === -3 ||
    (skill.id !== -1 &&
      skill.id !== -4 &&
      skill.id !== ID.TROUBADOUR_BLADECALL &&
      !skill.ambush &&
      (skill.type === "Weapon" ||
        !eliteSpecializations.has(String(skill.specialization || "")))),
);
const fragmentCache = new Map<string, ProfessionModuleCatalogFragment>();

export function mesmerModuleCatalog(
  moduleId: string,
): Readonly<ProfessionModuleCatalogFragment> {
  const cached = fragmentCache.get(moduleId);
  if (cached) return cached;
  if (moduleId !== "Core" && !eliteSpecializations.has(moduleId)) {
    throw new Error(`Unknown Mesmer catalog module ${moduleId}.`);
  }
  const core = moduleId === "Core";
  const skills = core
    ? coreRuntimeSkills
    : mesmerCatalog.skills.filter((skill) =>
        moduleId === "Mirage"
          ? skill.id === -1 ||
            skill.ambush ||
            (skill.type !== "Weapon" && skill.specialization === moduleId)
          : moduleId === "Chronomancer"
            ? skill.id === -4 ||
              (skill.type !== "Weapon" && skill.specialization === moduleId)
            : moduleId === "Troubadour"
              ? skill.id === ID.TROUBADOUR_BLADECALL ||
                (skill.type !== "Weapon" && skill.specialization === moduleId)
              : skill.type !== "Weapon" && skill.specialization === moduleId,
      );
  const traits = mesmerCatalog.traits.filter((trait) =>
    core
      ? !eliteSpecializations.has(String(trait.specialization || ""))
      : trait.specialization === moduleId,
  );
  const specializations = mesmerCatalog.specializations.filter(
    (specialization) =>
      core ? !specialization.elite : specialization.name === moduleId,
  );
  const fragment = Object.freeze({
    skills: Object.freeze([...skills]),
    traits: Object.freeze([...traits]),
    specializations: Object.freeze([...specializations]),
    ...(core
      ? {
          weapons: Object.freeze([...mesmerCatalog.weapons]),
          weaponHands: new Map(mesmerCatalog.weaponHands),
        }
      : {}),
  });
  fragmentCache.set(moduleId, fragment);
  return fragment;
}
