import { createNativeModuleData } from '#gw2/integrations/patches/authoring/catalog.js';
import { defineProfessionWeapons } from '#gw2/content/professions/lib/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/content/professions/lib/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/content/professions/mesmer/data/mesmer-api-metadata.js';
import { MESMER_SUPPLEMENTAL_SKILLS } from '#gw2/content/professions/mesmer/data/mesmer-supplemental-skills.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import {
  defaultMesmerSkillIdForDuplicateName,
  MESMER_DUPLICATE_SKILL_NAMES
} from '#gw2/content/professions/mesmer/data/duplicate-skill-names.js';
import { TRAITS } from '#gw2/content/professions/mesmer/data/traits-data.js';
import {
  MESMER_FLIP_PARENT_BY_CHILD_ID,
  prepareMesmerSkillForCatalog
} from '#gw2/content/professions/mesmer/mechanics/skill-handlers.js';
import type { CatalogEntity, Skill, SkillFragment, SkillId } from '#gw2/platform/engine/types.js';
import type { NativeCatalogOptions } from '#gw2/integrations/patches/authoring/module-types.js';

const generated: readonly Skill[] = [...SKILLS, ...MESMER_SUPPLEMENTAL_SKILLS].map((skill) => ({
  ...skill,
  effects: []
}));

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
  readonly supplementalSkillMechanics?: Readonly<Record<string, SkillFragment>>;
}

function prepareMechanics(mechanics: Readonly<Record<string, SkillFragment>>): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanics).map(([id, skill]) => [
        id,
        prepareMesmerSkillForCatalog({
          ...skill,
          id: Number(id)
        })
      ])
    )
  );
}

// Normalize generated and supplemental Mesmer mechanics for one module, moving
// ammo ownership from flip parents to ammo-bearing child skills where required.
export function createMesmerModuleData(
  id: string,
  { skillMechanics, supplementalSkillMechanics = {}, extraSkills = [], balanceProfiles = [] }: MesmerModuleDataOptions
) {
  const flipParentsWithAmmoChild = new Set<number>(
    Object.entries(supplementalSkillMechanics)
      .filter(([, skill]) => Number(skill.ammo || 0) > 0)
      .flatMap(([id]) => {
        const parentId = MESMER_FLIP_PARENT_BY_CHILD_ID[Number(id)];

        return parentId == null ? [] : [parentId];
      })
  );

  const skillOverrides: Readonly<Record<SkillId, SkillFragment>> = Object.freeze(
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

  return createNativeModuleData({
    id,
    generatedSkills: generated,
    skillMechanics: prepareMechanics({
      ...skillMechanics,
      ...supplementalSkillMechanics
    }),
    skillOverrides,
    extraSkills: extraSkills.map((skill) =>
      prepareMesmerSkillForCatalog({
        ...skill,
        id: Number(skill.id)
      })
    ),
    balanceProfiles,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    ...(id === 'Core' ? WEAPON_DATA : {})
  });
}
