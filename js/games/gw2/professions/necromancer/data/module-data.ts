import {
  createFlipParentMap,
  createProfessionModuleDataFactory,
  defineProfessionWeapons,
  normalizeGeneratedSkill
} from '#gw2/professions/shared/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/professions/shared/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/professions/necromancer/data/necromancer-api-metadata.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_SUPPLEMENTAL_SKILLS } from '#gw2/professions/necromancer/data/necromancer-supplemental-skills.js';
import { TRAITS } from '#gw2/professions/necromancer/data/traits-data.js';
import type { CatalogEntity, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { AutoattackChainOptions } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';

const STATIC_REPLACEMENT_PAIRS = new Set<string>([
  `${ID.LIFE_BLAST}:${ID.DHUUMFIRE_BLAST}`,
  `${ID.FEAST_OF_CORRUPTION}:${ID.DEVOURING_DARKNESS}`,
  `${ID.DESERT_SHROUD}:${ID.SANDSTORM_SHROUD}`
]);

const UNSUPPORTED_SKILL_IDS = new Set<SkillId>([
  ID.SUMMON_FLESH_WURM,
  ID.NECROTIC_TRAVERSAL,
  ID.CORRUPT_BOON,
  ID.EPIDEMIC,
  ID.SPECTRAL_RING
]);

const allSkills: readonly Skill[] = Object.freeze(
  [...SKILLS, ...NECROMANCER_SUPPLEMENTAL_SKILLS]
    .filter((skill) => !UNSUPPORTED_SKILL_IDS.has(skill.id))
    .sort((left, right) => Number(left.id) - Number(right.id))
);

const generatedById = new Map<SkillId, Skill>(allSkills.map((skill) => [skill.id, skill]));

const flipParentById = createFlipParentMap(allSkills, {
  include(parent, child) {
    return child.name !== parent.name && !STATIC_REPLACEMENT_PAIRS.has(`${parent.id}:${parent.flipSkillId}`);
  }
});

const generated: readonly Skill[] = allSkills.map((skill) => {
  const flipParentId = flipParentById.get(skill.id);

  return {
    ...normalizeGeneratedSkill(skill, flipParentId ?? null),
    flipParent: flipParentId == null ? '' : generatedById.get(flipParentId)?.name || ''
  };
});

// Keeps the one canonical shade owned by Scourge after duplicate API forms are removed.
const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Scourge: [ID.MANIFEST_SAND_SHADE]
});

const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh',
  Dagger: 'mh+oh',
  Focus: 'oh',
  Greatsword: '2h',
  Pistol: 'mh',
  Scepter: 'mh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh',
  Torch: 'oh',
  Warhorn: 'oh'
});

interface NecromancerModuleDataOptions extends ProfessionModuleDataOptions {
  readonly autoattackChains?: AutoattackChainOptions;
}

/** Applies shared shroud weapon attribution to module-owned Necromancer skill mechanics. */
function applyNecromancerSkillDefaults(
  mechanicsById: Readonly<Record<string, Partial<Skill>>>
): Readonly<Record<string, Partial<Skill>>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanicsById).map(([skillId, mechanics]) => {
        // Real shroud forms share Hammer weapon strength; shade and transform mechanics keep their declared profile.
        const shroudSkillWeapon = ['death', 'reaper', 'harbinger'].includes(String(mechanics.shroud || ''))
          ? 'Hammer'
          : null;

        return [
          skillId,
          {
            ...mechanics,
            ...(shroudSkillWeapon
              ? {
                  skillWeapon: shroudSkillWeapon
                }
              : {})
          }
        ];
      })
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

/** Builds one Necromancer module's catalog slice from shared API data and module-owned mechanics. */
export function createNecromancerModuleData(id: string, { skillMechanics, ...options }: NecromancerModuleDataOptions) {
  return createModuleData(id, {
    ...options,
    skillMechanics: applyNecromancerSkillDefaults(skillMechanics)
  });
}
