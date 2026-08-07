import { createNativeModuleData } from "../../platform/gw2/native-profession.js";
import { SKILLS, SPECIALIZATIONS } from "./data/mesmer-api-metadata.js";
import { MESMER_SUPPLEMENTAL_SKILLS } from "./data/mesmer-supplemental-skills.js";
import { MESMER_SKILL_IDS as ID } from "./data/ids.js";
import {
  defaultMesmerLegacySkillId,
  MESMER_DUPLICATE_SKILL_NAMES,
} from "./data/legacy-skill-resolver.js";
import { TRAITS } from "./data/traits-data.js";
import {
  MESMER_FLIP_PARENT_BY_CHILD_ID,
  prepareMesmerSkillForCatalog,
} from "./mechanics/handler-mechanics.js";
import type {
  CatalogEntity,
  Skill,
  SkillFragment,
  SkillHandlerStrategy,
  SkillId,
} from "../../platform/engine/types.js";
import type { NativeCatalogOptions } from "../../platform/gw2/native-profession.js";

const generated: readonly Skill[] = [
  ...SKILLS,
  ...MESMER_SUPPLEMENTAL_SKILLS,
].map((skill) => ({ ...skill, implemented: false, effects: [] }));

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> =
  Object.freeze({
    Mirage: [
      ID.DODGE_MIRAGE_CLOAK, ID.PICK_UP_MIRAGE_MIRROR,
      ID.ETHER_BARRAGE, ID.IMAGINARY_AXES,
      ID.MIRAGE_THRUST, ID.PHANTOM_RAZOR, ID.EFFERVESCENCE,
      ID.FRACTURED_GLASS, ID.SPLIT_SURGE, ID.CHAOS_VORTEX,
    ],
    Troubadour: [ID.TROUBADOUR_BLADECALL, ID.DODGE_TROUBADOUR],
  });
const SPECIALIZATION_ONLY_SKILL_OWNERS = Object.freeze(Object.fromEntries(
  Object.entries(SPECIALIZATION_ONLY_SKILLS).flatMap(([owner, skillIds]) =>
    skillIds.map((skillId) => [String(skillId), owner])
  ),
));

const WEAPONS = Object.freeze([
  "Axe", "Dagger", "Focus", "Greatsword", "Pistol", "Rifle", "Scepter",
  "Shield", "Spear", "Staff", "Sword", "Torch",
]);
const WEAPON_HANDS = Object.freeze({
  Axe: "mh", Dagger: "mh", Focus: "oh", Greatsword: "2h", Pistol: "oh",
  Rifle: "2h", Scepter: "mh", Shield: "oh", Spear: "2h", Staff: "2h",
  Sword: "mh+oh", Torch: "oh",
});

export const MESMER_NATIVE_CATALOG_OPTIONS: NativeCatalogOptions =
  Object.freeze({
    skillNameCollision: "first",
    skillNameOverrides: Object.freeze(Object.fromEntries(
      MESMER_DUPLICATE_SKILL_NAMES.flatMap((name) => {
        const id = defaultMesmerLegacySkillId(name);
        return id == null ? [] : [[name, id]];
      }),
    )),
  });

interface MesmerModuleDataOptions<TContext extends object> {
  readonly skillMechanics: Readonly<Record<string, SkillFragment>>;
  readonly supplementalSkillMechanics?: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly handlers?:
    | ReadonlyMap<string, SkillHandlerStrategy<TContext>>
    | Readonly<Record<string, SkillHandlerStrategy<TContext>>>;
}

function prepareMechanics(
  mechanics: Readonly<Record<string, SkillFragment>>,
): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(Object.fromEntries(
    Object.entries(mechanics).map(([id, skill]) => [
      id,
      prepareMesmerSkillForCatalog({ ...skill, id: Number(id) }),
    ]),
  ));
}

export function createMesmerModuleData<TContext extends object>(
  id: string,
  {
    skillMechanics,
    supplementalSkillMechanics = {},
    extraSkills = [],
    handlers,
  }: MesmerModuleDataOptions<TContext>,
) {
  const flipParentsWithAmmoChild = new Set<number>(
    Object.entries(supplementalSkillMechanics)
      .filter(([, skill]) => Number(skill.ammo || 0) > 0)
      .flatMap(([id]) => {
        const parentId = MESMER_FLIP_PARENT_BY_CHILD_ID[Number(id)];
        return parentId == null ? [] : [parentId];
      }),
  );
  const skillOverrides: Readonly<Record<SkillId, SkillFragment>> =
    Object.freeze(Object.fromEntries(
      generated
        .filter((skill) => flipParentsWithAmmoChild.has(Number(skill.id)))
        .map((skill) => [skill.id, { ammo: 0, ammoRecharge: 0 }]),
    ));
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    skillMechanics: prepareMechanics({
      ...skillMechanics,
      ...supplementalSkillMechanics,
    }),
    skillOverrides,
    extraSkills: extraSkills.map((skill) =>
      prepareMesmerSkillForCatalog({ ...skill, id: Number(skill.id) })
    ),
    handlers,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === "Core" ? { weapons: WEAPONS, weaponHands: WEAPON_HANDS } : {}),
  });
}
