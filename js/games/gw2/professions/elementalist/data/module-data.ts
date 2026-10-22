import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
/**
 * Elementalist catalog generation.
 *
 * Enriches each owner's authored declarations with API presentation metadata and
 * local chain definitions. Shared assembly validates and normalizes the resulting
 * module contributions; combat behavior remains in each owner-local skill fragment.
 */
import { createProfessionModuleDataFactory, defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/professions/shared/catalog-data.js';
import {
  SKILLS as ELEMENTALIST_API_SKILLS,
  SPECIALIZATIONS as ELEMENTALIST_API_SPECIALIZATIONS
} from '#gw2/professions/elementalist/data/elementalist-api-metadata.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  ELEMENTALIST_API_SKILL_ID_OVERRIDES,
  ELEMENTALIST_LOADOUT_SKILL_IDS
} from '#gw2/professions/elementalist/data/skill-identities.js';
import { TRAITS } from '#gw2/professions/elementalist/data/traits-data.js';

// Stable family positions preserve name-collision winners and circular-chain roots
// even though owners now contribute their skills independently.
const ELEMENTALIST_SKILL_ORDER = new Map<number, number>(
  [...Object.values(ID), SHARED_SKILL_IDS.DODGE].map((id, index) => [id, index])
);

// Inline placeholder icon so a skill with no API art still renders a stable tile.
const ELEMENTALIST_FALLBACK_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#40252b"/><text x="32" y="38" text-anchor="middle" fill="#d65c69" font-size="26">E</text></svg>'
  );

// Names that differ between the authored declarations and the API metadata.
const SKILL_NAME_ALIASES = new Map<string, string>([['Frozen Grounds', 'Frozen Ground']]);
const API_SKILLS_BY_NAME = new Map(ELEMENTALIST_API_SKILLS.map((skill) => [skill.name, skill]));
const API_SKILLS_BY_ID = new Map(ELEMENTALIST_API_SKILLS.map((skill) => [Number(skill.id), skill]));
const SLOT_SKILL_TYPES = new Set(['Heal', 'Utility', 'Elite']);
const ATTUNEMENT_VARIANT_PATTERN = /\s*\((?:Fire|Water|Air|Earth)\)$/;

// Finds API metadata by name, tolerating the aliases, attunement suffixes, and quoted or
// exclamation-marked spellings the API uses for the same skill.
function apiSkill(name: string): ElementalistSkill | undefined {
  const alias = SKILL_NAME_ALIASES.get(name);

  const base = name.replace(/\s*\(.*\)$/, '');

  const candidates = [alias, name, base, `“${name}”`, `"${name}"`, `${name}!`, `“${base}”`, `"${base}"`];

  return candidates
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => API_SKILLS_BY_NAME.get(candidate))
    .find((candidate) => candidate != null);
}

// API presentation and loadout grouping supply defaults; each owner's declarations
// retain authority over simulator identity, mechanics, and explicit presentation.
function enrichSkill(skill: ElementalistSkill): ElementalistSkill {
  const skillId = Number(skill.id);

  const apiSkillId = ELEMENTALIST_API_SKILL_ID_OVERRIDES.get(skillId) ?? skillId;

  const loadoutSkillId = ELEMENTALIST_LOADOUT_SKILL_IDS.get(skillId);

  const metadata =
    API_SKILLS_BY_ID.get(apiSkillId) ||
    (loadoutSkillId == null ? undefined : API_SKILLS_BY_ID.get(loadoutSkillId)) ||
    apiSkill(skill.name);

  const selectionName = skill.name.replace(ATTUNEMENT_VARIANT_PATTERN, '');

  const isAttunementSlotVariant =
    SLOT_SKILL_TYPES.has(String(skill.type)) && Boolean(skill.attunement) && loadoutSkillId != null;

  return {
    ...(loadoutSkillId == null ? {} : { loadoutSkillId }),
    ...(isAttunementSlotVariant
      ? {
          displayName: selectionName,
          // Attunement projections share one picker entry; fixed elemental summons remain separate.
          paletteTileId: loadoutSkillId
        }
      : {}),
    ...(metadata?.description
      ? {
          description: metadata.description
        }
      : {}),
    icon: metadata?.icon || ELEMENTALIST_FALLBACK_ICON,
    ...skill
  };
}

// Include conjured weapon bars when discovering closed slot-one chains; open chains
// and non-autoattack sequences are registered through explicit declarations.
function circularElementalistAutoattackChains(skills: readonly ElementalistSkill[]): readonly (readonly number[])[] {
  const skillsById = new Map(skills.map((skill) => [Number(skill.id), skill]));

  const visited = new Set<number>();
  const chains: number[][] = [];

  for (const root of skills) {
    const rootId = Number(root.id);

    if (
      visited.has(rootId) ||
      root.type !== 'Weapon' ||
      root.slot !== 'Weapon_1' ||
      !(root.weapon || root.skillWeapon) ||
      root.nextChainId == null
    ) {
      continue;
    }

    const chain: number[] = [];
    const path = new Set<number>();

    let current: ElementalistSkill | undefined = root;

    while (current && !path.has(Number(current.id))) {
      const id = Number(current.id);

      path.add(id);
      chain.push(id);

      current = current.nextChainId == null ? undefined : skillsById.get(Number(current.nextChainId));
    }

    for (const id of path) {
      visited.add(id);
    }

    if (current?.id === root.id && chain.length > 1) {
      chains.push(chain);
    }
  }

  return Object.freeze(chains.map((chain) => Object.freeze(chain)));
}

// Aerial Agility is a genuine three-step pistol chain rather than a slot-1
// autoattack, so circularElementalistAutoattackChains (Weapon_1 only, to skip
// the two-skill aura/transmute flips) never derives it. Declaring it explicitly
// gives its stages a chainRoot/chainStep, which collapses them to one palette
// tile and reuses the shared in-order gate; Elementalist supplies its distinct
// preserve, timeout, and cooldown-restart behavior as a transition extension.
const AERIAL_AGILITY_CHAIN = Object.freeze(
  [ID.AERIAL_AGILITY, ID.AERIAL_AGILITY_CHAIN, ID.AERIAL_AGILITY_DASH].map(Number)
);

// Elementalist's equippable weapons and the hand each occupies.
const WEAPON_DATA = defineProfessionWeapons({
  Dagger: 'mh+oh',
  Focus: 'oh',
  Hammer: '2h',
  Pistol: 'mh',
  Scepter: 'mh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh',
  Warhorn: 'oh'
});

// Preserve Elementalist fields through module registration and selected catalog lookups.
const createModuleData = createProfessionModuleDataFactory<ElementalistSkill>({
  traits: TRAITS,
  specializations: ELEMENTALIST_API_SPECIALIZATIONS,
  core: WEAPON_DATA
});

/**
 * Enriches the supplied declarations once and contributes finished skills directly,
 * so shared assembly never has to merge a second copy of their mechanics. Family
 * positions retain global ordering; chains and Weaver exclusivity stay owner-local.
 */
export function createElementalistModuleData(
  id: string,
  { skillMechanics, ...options }: ProfessionModuleDataOptions<ElementalistSkill>
) {
  const skills = Object.entries(skillMechanics).map(([key, declaration]) => {
    const skillId = Number(key);

    if (!ELEMENTALIST_SKILL_ORDER.has(skillId)) {
      throw new TypeError(`Unknown Elementalist skill declaration ${key}.`);
    }

    // The owning declaration supplies identity fields; shared catalog validation checks completeness.
    return enrichSkill({ ...declaration, id: skillId } as ElementalistSkill);
  });
  skills.sort(
    (left, right) => ELEMENTALIST_SKILL_ORDER.get(Number(left.id))! - ELEMENTALIST_SKILL_ORDER.get(Number(right.id))!
  );

  return Object.freeze({
    ...createModuleData(id, { ...options, skillMechanics: {} }),
    generatedSkills: Object.freeze(skills),
    generatedSkillOrder: new Map(skills.map((skill) => [skill.id, ELEMENTALIST_SKILL_ORDER.get(Number(skill.id))!])),
    autoattackChains: {
      additional: Object.freeze([
        ...circularElementalistAutoattackChains(skills),
        ...(id === 'Core' ? [AERIAL_AGILITY_CHAIN] : [])
      ])
    },
    // Dual attacks require Weaver's hands and handlers; weapon mastery does not share them with other elites.
    ...(id === 'Weaver'
      ? {
          specializationOnlySkillIds: Object.freeze(
            skills.filter((skill) => skill.type === 'Weapon').map((skill) => skill.id)
          )
        }
      : {})
  });
}
