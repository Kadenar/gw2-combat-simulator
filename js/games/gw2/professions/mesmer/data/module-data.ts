import {
  createFlipParentMap,
  createProfessionModuleDataFactory,
  defineProfessionWeapons,
  normalizeGeneratedSkill
} from '#gw2/professions/shared/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/professions/shared/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/professions/mesmer/data/mesmer-api-metadata.js';
import { MESMER_SUPPLEMENTAL_SKILLS } from '#gw2/professions/mesmer/data/mesmer-supplemental-skills.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import {
  defaultMesmerSkillIdForDuplicateName,
  MESMER_DUPLICATE_SKILL_NAMES
} from '#gw2/professions/mesmer/data/duplicate-skill-names.js';
import { TRAITS } from '#gw2/professions/mesmer/data/traits-data.js';
import type { CatalogEntity, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { NativeCatalogOptions } from '#gw2/platform/profession-definition/module-types.js';

const allSkills: readonly Skill[] = [...SKILLS, ...MESMER_SUPPLEMENTAL_SKILLS];

// Same-name API flips are specialization replacements, not runtime flip palettes.
const flipParentById = createFlipParentMap(allSkills, {
  include: (parent, child) => parent.name !== child.name
});

const generated: readonly Skill[] = allSkills.map((skill) =>
  normalizeGeneratedSkill(skill, flipParentById.get(skill.id) ?? null)
);

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Mirage: [
    ID.DODGE_MIRAGE_CLOAK,
    ID.PICK_UP_MIRAGE_MIRROR,
    ID.ETHER_BARRAGE,
    ID.IMAGINARY_AXES,
    ID.MIRAGE_THRUST,
    ID.PHANTOM_RAZOR,
    ID.EFFERVESCENCE,
    ID.FRACTURED_GLASS,
    ID.SPLIT_SURGE,
    ID.CHAOS_VORTEX
  ],
  Troubadour: [ID.TROUBADOUR_BLADECALL, ID.DODGE_TROUBADOUR]
});

const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh',
  Dagger: 'mh',
  Focus: 'oh',
  Greatsword: '2h',
  Pistol: 'oh',
  Rifle: '2h',
  Scepter: 'mh',
  Shield: 'oh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh',
  Torch: 'oh'
});

export const MESMER_NATIVE_CATALOG_OPTIONS: NativeCatalogOptions = Object.freeze({
  skillNameCollision: 'first',
  skillNameOverrides: Object.freeze(
    Object.fromEntries(
      MESMER_DUPLICATE_SKILL_NAMES.flatMap((name) => {
        const id = defaultMesmerSkillIdForDuplicateName(name);

        return id == null ? [] : [[name, id]];
      })
    )
  )
});

interface MesmerModuleDataOptions extends ProfessionModuleDataOptions {
  readonly supplementalSkillMechanics?: Readonly<Record<string, Partial<Skill>>>;
}

function prepareMechanics(
  mechanics: Readonly<Record<string, Partial<Skill>>>
): Readonly<Record<string, Partial<Skill>>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanics).map(([id, skill]) => [
        id,
        {
          ...skill,
          id: Number(id)
        }
      ])
    )
  );
}

const createModuleData = createProfessionModuleDataFactory({
  generatedSkills: generated,
  traits: TRAITS as readonly CatalogEntity[],
  specializations: SPECIALIZATIONS,
  specializationOnlySkills: SPECIALIZATION_ONLY_SKILLS,
  core: WEAPON_DATA
});

// Normalize generated and supplemental Mesmer mechanics for one module, moving
// ammo ownership from flip parents to ammo-bearing child skills where required.
export function createMesmerModuleData(
  id: string,
  { skillMechanics, supplementalSkillMechanics = {}, extraSkills = [], ...options }: MesmerModuleDataOptions
) {
  const flipParentsWithAmmoChild = new Set<number>(
    Object.entries(supplementalSkillMechanics)
      .filter(([, skill]) => Number(skill.ammo || 0) > 0)
      .flatMap(([id]) => {
        const parentId = flipParentById.get(Number(id));

        return parentId == null ? [] : [Number(parentId)];
      })
  );

  const skillOverrides: Readonly<Record<SkillId, Partial<Skill>>> = Object.freeze(
    Object.fromEntries(
      generated
        .filter((skill) => flipParentsWithAmmoChild.has(Number(skill.id)))
        .map((skill) => [
          skill.id,
          {
            ammo: 0,
            ammoRecharge: 0
          }
        ])
    )
  );

  return createModuleData(id, {
    ...options,
    skillMechanics: prepareMechanics({
      ...skillMechanics,
      ...supplementalSkillMechanics
    }),
    skillOverrides,
    extraSkills: extraSkills.map((skill) => ({
      ...skill,
      id: Number(skill.id)
    }))
  });
}
