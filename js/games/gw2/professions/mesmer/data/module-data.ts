import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
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
import { TRAITS } from '#gw2/professions/mesmer/data/traits-data.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { NativeCatalogOptions } from '#gw2/platform/profession-definition/module-types.js';

const allSkills: readonly MesmerSkill[] = [...SKILLS, ...MESMER_SUPPLEMENTAL_SKILLS];

// Same-name API flips are specialization replacements, not runtime flip palettes.
// API replacement faces are explicitly authored relationships, not display-name equivalence.
const STATIC_NAME_REPLACEMENT_PAIRS = new Set(['43761:69385']);
const flipParentById = createFlipParentMap(allSkills, {
  include: (parent, child) => !STATIC_NAME_REPLACEMENT_PAIRS.has(`${parent.id}:${child.id}`)
});

/** Shared Axe identities are replaced by Mirage in both equipment and cast selection. */
export const NON_MIRAGE_AXE_SKILL_IDS: ReadonlySet<SkillId> = new Set([
  ID.AXES_OF_SYMMETRY_NON_MIRAGE,
  ID.LINGERING_THOUGHTS_NON_MIRAGE
]);

// Explicit replacement families allow palette selection to survive label changes.
const WEAPON_TILE_IDS = new Map<SkillId, SkillId>([
  [ID.BLADECALL, ID.BLADECALL_NON_VIRTUOSO],
  [ID.AXES_OF_SYMMETRY, ID.AXES_OF_SYMMETRY_NON_MIRAGE],
  [ID.LINGERING_THOUGHTS, ID.LINGERING_THOUGHTS_NON_MIRAGE]
]);

// Correct stale API specialization labels before palette ranking and module assembly.
const generated: readonly MesmerSkill[] = allSkills.map((skill) => ({
  ...normalizeGeneratedSkill(skill, flipParentById.get(skill.id) ?? null),
  ...(WEAPON_TILE_IDS.has(skill.id) ? { paletteTileId: WEAPON_TILE_IDS.get(skill.id) } : {}),
  specialization:
    NON_MIRAGE_AXE_SKILL_IDS.has(skill.id) || skill.id === ID.BLADECALL_NON_VIRTUOSO
      ? ''
      : skill.id === ID.BLADECALL
        ? 'Virtuoso'
        : skill.specialization
}));

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Mirage: [
    ID.AXES_OF_SYMMETRY,
    ID.LINGERING_THOUGHTS,
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
  Virtuoso: [ID.BLADECALL],
  Troubadour: [SHARED_SKILL_IDS.DODGE]
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
  // Application-wide names use Core defaults; active modules override their replacements.
  skillNameOverrides: Object.freeze({
    'Axes of Symmetry': ID.AXES_OF_SYMMETRY_NON_MIRAGE,
    'Lingering Thoughts': ID.LINGERING_THOUGHTS_NON_MIRAGE,
    Bladecall: ID.BLADECALL_NON_VIRTUOSO,
    'Lively Lute': ID.LIVELY_LUTE,
    'Harmonious Harp': ID.HARMONIOUS_HARP_ALTERNATE
  })
});

interface MesmerModuleDataOptions extends ProfessionModuleDataOptions<MesmerSkill> {
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
  readonly supplementalSkillMechanics?: Readonly<Record<string, Partial<MesmerSkill>>>;
}

function prepareMechanics(
  mechanics: Readonly<Record<string, Partial<MesmerSkill>>>
): Readonly<Record<string, Partial<MesmerSkill>>> {
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

// Preserve Mesmer fields through module assembly and runtime catalog lookups.
const createModuleData = createProfessionModuleDataFactory<MesmerSkill>({
  generatedSkills: generated,
  traits: TRAITS,
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
      .filter(([, skill]) => (skill.ammo || 0) > 0)
      .flatMap(([id]) => {
        const parentId = flipParentById.get(Number(id));

        return parentId == null ? [] : [Number(parentId)];
      })
  );

  const skillOverrides: Readonly<Record<SkillId, Partial<MesmerSkill>>> = Object.freeze(
    Object.fromEntries(
      generated
        .filter((skill) => flipParentsWithAmmoChild.has(skill.id))
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
    extraSkills
  });
}
