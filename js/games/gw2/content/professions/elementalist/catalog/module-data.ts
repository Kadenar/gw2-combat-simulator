/**
 * Elementalist catalog generation.
 *
 * Turns each module's authored skill mechanics into finished catalog skills: it merges
 * the declarations from core and every elite, layers Guild Wars 2 API metadata (icons,
 * descriptions) onto them, applies the profession's hitbox/packet corrections, derives
 * the autoattack chains, and hands each module back only the entries it owns.
 */
import { createNativeModuleData } from '#gw2/integrations/patches/authoring/catalog.js';
import { defineProfessionWeapons } from '#gw2/content/professions/lib/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/content/professions/lib/catalog-data.js';
import {
  SKILLS as ELEMENTALIST_API_SKILLS,
  SPECIALIZATIONS as ELEMENTALIST_API_SPECIALIZATIONS
} from '#gw2/content/professions/elementalist/data/elementalist-api-metadata.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import {
  ELEMENTALIST_API_SKILL_ID_OVERRIDES,
  ELEMENTALIST_LOADOUT_SKILL_IDS
} from '#gw2/content/professions/elementalist/data/skill-identities.js';
import { TRAITS } from '#gw2/content/professions/elementalist/data/traits-data.js';
import { ELEMENTALIST_CORE_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/index.js';
import { CATALYST_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/specializations/catalyst/skills/index.js';
import { EVOKER_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/specializations/evoker/skills/index.js';
import { TEMPEST_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/specializations/tempest/skills/index.js';
import { WEAVER_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/specializations/weaver/skills/index.js';
import type { CatalogEntity, SchedulerRecord, Skill, SkillEffect, SkillFragment } from '#gw2/platform/engine/types.js';

// Catalog generation needs the complete module-owned declaration set, and the
// duplicate check prevents one module from silently overwriting another.
const elementalistMechanicsEntries = [
  ELEMENTALIST_CORE_SKILL_MECHANICS,
  TEMPEST_SKILL_MECHANICS,
  WEAVER_SKILL_MECHANICS,
  CATALYST_SKILL_MECHANICS,
  EVOKER_SKILL_MECHANICS
].flatMap((fragment) => Object.entries(fragment));

if (new Set(elementalistMechanicsEntries.map(([skillId]) => skillId)).size !== elementalistMechanicsEntries.length) {
  throw new TypeError('Duplicate Elementalist skill-mechanics ownership.');
}

const ELEMENTALIST_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze(
  Object.fromEntries(elementalistMechanicsEntries)
);

// Inline placeholder icon so a skill with no API art still renders a stable tile.
const ELEMENTALIST_FALLBACK_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#40252b"/><text x="32" y="38" text-anchor="middle" fill="#d65c69" font-size="26">E</text></svg>'
  );

// Art for skills the API metadata does not resolve by name, plus the palette's Dodge tile.
const SKILL_ICON_OVERRIDES = new Map<string, string>([
  [
    'Deploy Jade Sphere (Fire)',
    'https://render.guildwars2.com/file/22CA7C0F420C7F61CEBFA323DF3AADC5EF237475/2491598.png'
  ],
  [
    'Deploy Jade Sphere (Water)',
    'https://render.guildwars2.com/file/6016319AAF18417F0401800EF36C0F18E207FFD5/2491600.png'
  ],
  [
    'Deploy Jade Sphere (Air)',
    'https://render.guildwars2.com/file/07D9C76FEB07BB04B9D07A05D87C09A0A0AE0319/2491594.png'
  ],
  [
    'Deploy Jade Sphere (Earth)',
    'https://render.guildwars2.com/file/97BEF22148DDA3159B4CF6DB18ECFEDE7107710B/2491596.png'
  ],
  ['Volcano', 'https://render.guildwars2.com/file/334EA928E56F38C176A22415DE3ECE144C5FD5BB/3379101.png'],
  ['Jökulhlaup', 'https://render.guildwars2.com/file/48EB1A03297EE4DFA0FE2CA41F0B02B77302060B/3379104.png'],
  ['Derecho', 'https://render.guildwars2.com/file/94F1A894667CA4F3407C57B055F8236804264B1F/3379095.png'],
  ['Haboob', 'https://render.guildwars2.com/file/562F2D0ED67AD8453F9CA60F27DB154F2E7543FC/3379098.png'],
  ['Dodge', 'https://wiki.guildwars2.com/images/b/b2/Dodge.png']
]);

// Names that differ between the authored declarations and the API metadata.
const SKILL_NAME_ALIASES = new Map<string, string>([['Frozen Grounds', 'Frozen Ground']]);
const API_SKILLS_BY_NAME = new Map(ELEMENTALIST_API_SKILLS.map((skill) => [skill.name, skill]));
const API_SKILLS_BY_ID = new Map(ELEMENTALIST_API_SKILLS.map((skill) => [Number(skill.id), skill]));
const SLOT_SKILL_TYPES = new Set(['Heal', 'Utility', 'Elite']);
const ATTUNEMENT_VARIANT_PATTERN = /\s*\((?:Fire|Water|Air|Earth)\)$/;
const HAMMER_ORB_PACKET_SKILLS = new Set(['Flame Wheel', 'Icy Coil', 'Crescent Wind', 'Rocky Loop']);
const HAMMER_ORB_PACKET_COUNT = 15;

/**
 * Maximum number of packets each listed skill can land against a small hitbox. Packets
 * past the cap are stamped with their chronological hit index and later cancelled by the
 * hitbox event handler when the build assumes a small target.
 */
export const ELEMENTALIST_SMALL_HITBOX_CAPS: ReadonlyMap<string, number> = new Map([
  ['Meteor Shower', 12],
  ['Lightning Orb', 11],
  ['Frost Storm', 14],
  ['Invoke Lightning', 9],
  ['Glyph of Storms (Air)', 20],
  ['Glyph of Storms (Water)', 11],
  ['Dust Storm', 6],
  ['Fiery Whirl', 4]
]);

function hitboxMetadata(hitIndex: number, smallHitboxCap: number) {
  return {
    hitboxIndex: hitIndex,
    smallHitboxCap
  };
}

// Stamp every damage packet with its chronological hit index and the skill's cap, so the
// runtime can drop the packets that a small hitbox would never absorb. Non-strike effects
// (conditions applied alongside a hit) inherit the index of the strike they accompany.
function withSmallHitboxCap(skill: Skill, smallHitboxCap: number): readonly SkillEffect[] {
  const effects = skill.effects || [];
  const chronologicalStrikeIndices = new Map<string, number>();
  // Hitbox caps follow chronological packet order even when separate canonical timelines preserve same-time causality.
  effects
    .flatMap((effect, effectIndex) => {
      if (effect.type !== 'strike') return [];
      if (Array.isArray(effect.ticks)) {
        return effect.ticks.map((tick, tickIndex) => ({ effectIndex, tickIndex, atMs: Number(tick.atMs) }));
      }

      return [{ effectIndex, tickIndex: 0, atMs: Number(effect.atMs || 0) }];
    })
    .sort(
      (left, right) =>
        left.atMs - right.atMs || left.effectIndex - right.effectIndex || left.tickIndex - right.tickIndex
    )
    .forEach(({ effectIndex, tickIndex }, index) => {
      chronologicalStrikeIndices.set(`${effectIndex}:${tickIndex}`, index + 1);
    });

  let lastStrikeIndices: number[] = [];

  return effects.map((effect, effectIndex) => {
    if (effect.type === 'strike') {
      const hitCount = Array.isArray(effect.ticks)
        ? effect.ticks.length
        : Math.max(1, Math.trunc(Number(effect.hits || 1)));

      lastStrikeIndices = Array.from(
        { length: hitCount },
        (_, tickIndex) => chronologicalStrikeIndices.get(`${effectIndex}:${tickIndex}`) || 0
      );

      if (Array.isArray(effect.ticks)) {
        return {
          ...effect,
          ticks: effect.ticks.map((tick, index) => ({
            ...tick,
            metadata: {
              ...(tick.metadata || {}),
              ...hitboxMetadata(lastStrikeIndices[index], smallHitboxCap)
            }
          }))
        };
      }

      if (hitCount !== 1) {
        throw new TypeError(`${skill.name} needs individually timed strikes for hitbox caps.`);
      }

      return {
        ...effect,
        metadata: {
          ...(effect.metadata || {}),
          ...hitboxMetadata(lastStrikeIndices[0], smallHitboxCap)
        }
      };
    }

    if (!lastStrikeIndices.length) {
      return effect;
    }

    if (Array.isArray(effect.ticks) && effect.ticks.length === lastStrikeIndices.length) {
      return {
        ...effect,
        ticks: effect.ticks.map((tick, index) => ({
          ...tick,
          metadata: {
            ...((tick as SchedulerRecord).metadata as SchedulerRecord),
            ...hitboxMetadata(lastStrikeIndices[index], smallHitboxCap)
          }
        }))
      } as SkillEffect;
    }

    return {
      ...effect,
      metadata: {
        ...(effect.metadata || {}),
        ...hitboxMetadata(lastStrikeIndices[lastStrikeIndices.length - 1], smallHitboxCap)
      }
    } as SkillEffect;
  });
}

// Expand Wildfire's field lifetime from its packet timing while leaving every
// other generated effect unchanged.
function withLargeWildfireDuration(skill: Skill): readonly SkillEffect[] {
  return (skill.effects || []).map((effect) => {
    if (effect.type === 'strike') {
      return {
        ...effect,
        ticks: [
          ...(effect.ticks || []),
          ...[8560, 9560].map((atMs) => ({
            atMs,
            coefficient: 0.44,
            metadata: {
              damageKind: 'field-tick',
              largeHitboxOnly: true
            }
          }))
        ]
      };
    }

    if (effect.type === 'condition') {
      return {
        ...effect,
        ticks: [
          ...(effect.ticks || []),
          ...[8560, 9560].map((atMs) => ({
            atMs,
            condition: 'Burning',
            stacks: 1,
            duration: 3,
            metadata: {
              largeHitboxOnly: true
            }
          }))
        ]
      };
    }

    return effect;
  });
}

// Catalyst's hammer orbs are authored as a single representative packet; expand it into
// the one-per-second ticks the orb actually delivers over its lifetime.
function withHammerOrbPackets(skill: Skill): Skill {
  if (!HAMMER_ORB_PACKET_SKILLS.has(skill.name)) {
    return skill;
  }

  return {
    ...skill,
    effects: (skill.effects || []).map((effect) => {
      if (!Array.isArray(effect.ticks) || effect.ticks.length !== 1) {
        return effect;
      }

      const [packet] = effect.ticks;

      return {
        ...effect,
        ticks: Array.from(
          {
            length: HAMMER_ORB_PACKET_COUNT
          },
          (_, index) => ({
            ...packet,
            atMs: (index + 1) * 1000
          })
        )
      } as SkillEffect;
    })
  };
}

// Glyph of Elementals summons a pet rather than dealing skill damage, so drop the
// generated effects and cast profile in favor of the summon's own cast time.
function withElementalRuntimeProfiles(skill: Skill): Skill {
  if (!skill.name.startsWith('Glyph of Elementals')) {
    return skill;
  }

  const { quicknessCastTimeMs: _generatedCast, ...withoutGeneratedCast } = skill;

  return {
    ...withoutGeneratedCast,
    castTimeMs: 1250,
    cooldown: skill.cooldown,
    effects: []
  };
}

// Applies the packet-shape corrections in order: orb expansion, Wildfire's extended
// field, then hitbox indexing for any skill with a declared small-hitbox cap.
function withElementalistHitboxBehavior(skill: Skill): Skill {
  const withHammerPackets = withHammerOrbPackets(skill);

  const withLargeDuration =
    withHammerPackets.name === 'Wildfire'
      ? {
          ...withHammerPackets,
          effects: withLargeWildfireDuration(withHammerPackets)
        }
      : withHammerPackets;

  const smallHitboxCap = ELEMENTALIST_SMALL_HITBOX_CAPS.get(withHammerPackets.name);

  return smallHitboxCap == null
    ? withLargeDuration
    : {
        ...withLargeDuration,
        effects: withSmallHitboxCap(withLargeDuration, smallHitboxCap)
      };
}

// Finds API metadata by name, tolerating the aliases, attunement suffixes, and quoted or
// exclamation-marked spellings the API uses for the same skill.
function apiSkill(name: string): Skill | undefined {
  const alias = SKILL_NAME_ALIASES.get(name);

  const base = name.replace(/\s*\(.*\)$/, '');

  const candidates = [alias, name, base, `“${name}”`, `"${name}"`, `${name}!`, `“${base}”`, `"${base}"`];

  return candidates
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => API_SKILLS_BY_NAME.get(candidate))
    .find((candidate) => candidate != null);
}

// Every declared skill in canonical id order; ids without an owning module are skipped.
const ELEMENTALIST_DECLARED_SKILLS: readonly Skill[] = Object.freeze(
  Object.values(ID).flatMap((id) => {
    const declaration = ELEMENTALIST_SKILL_MECHANICS[id];

    return declaration
      ? [
          {
            ...declaration,
            id
          } as Skill
        ]
      : [];
  })
);

// The finished skill set: corrected mechanics joined to API identity metadata, plus the
// display and selection flags the editor needs (Weaver-only dual attunements, attunement
// variants collapsed under one display name, non-selectable and palette-only entries).
const generated: readonly Skill[] = Object.freeze(
  ELEMENTALIST_DECLARED_SKILLS.map(withElementalistHitboxBehavior)
    .map(withElementalRuntimeProfiles)
    .map((skill) => {
      const skillId = Number(skill.id);

      const apiSkillId = ELEMENTALIST_API_SKILL_ID_OVERRIDES.get(skillId) ?? skillId;

      const loadoutSkillId = ELEMENTALIST_LOADOUT_SKILL_IDS.get(skillId);

      const metadata =
        API_SKILLS_BY_ID.get(apiSkillId) ||
        (loadoutSkillId == null ? undefined : API_SKILLS_BY_ID.get(loadoutSkillId)) ||
        apiSkill(skill.name);

      const selectionName = skill.name.replace(ATTUNEMENT_VARIANT_PATTERN, '');

      const isAttunementSlotVariant =
        SLOT_SKILL_TYPES.has(String(skill.type)) && Boolean(skill.attunement) && selectionName !== skill.name;

      return {
        ...skill,
        ...(apiSkillId === skillId ? {} : { apiSkillId }),
        ...(loadoutSkillId == null ? {} : { loadoutSkillId }),
        ...(skill.type === 'Weapon' && String(skill.attunement || '').includes('+')
          ? {
              specialization: 'Weaver'
            }
          : {}),
        ...(isAttunementSlotVariant
          ? {
              displayName: selectionName
            }
          : {}),
        ...(skill.name === 'Tailored Victory'
          ? {
              slotSelectable: false
            }
          : {}),
        ...(skill.name === 'Dodge'
          ? {
              paletteAction: true
            }
          : {}),
        ...(metadata?.description
          ? {
              description: metadata.description
            }
          : {}),
        ...(skill.name === 'Glyph of Elementals'
          ? {
              displayName: 'Glyph of Elementals (Fire)',
              description: 'Glyph. Summon a Fire Elemental regardless of attunement.'
            }
          : {}),
        ...(skill.name === 'Glyph of Elementals (Earth)'
          ? {
              description: 'Glyph. Summon an Earth Elemental regardless of attunement.'
            }
          : {}),
        icon: SKILL_ICON_OVERRIDES.get(skill.name) || metadata?.icon || ELEMENTALIST_FALLBACK_ICON
      };
    })
);

const FINALIZED_SKILL_MECHANICS_BY_ID = new Map(
  generated.map((skill) => {
    const { id, ...mechanics } = skill;

    return [Number(id), mechanics] as const;
  })
);

// Returns the finished entries for exactly the ids a module declared, failing loudly if a
// module claims an id that catalog generation never produced.
function finalizedSkillMechanics(
  declarations: Readonly<Record<string, SkillFragment>>
): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(
    Object.fromEntries(
      Object.keys(declarations).map((id) => {
        const mechanics = FINALIZED_SKILL_MECHANICS_BY_ID.get(Number(id));

        if (!mechanics) {
          throw new TypeError(`Unknown Elementalist skill declaration ${id}.`);
        }

        return [id, mechanics];
      })
    )
  );
}

// Discover only closed slot-one chains from API next-chain links; open chains
// and non-autoattack sequences are registered through explicit declarations.
function circularElementalistAutoattackChains(): readonly (readonly number[])[] {
  const skillsById = new Map(generated.map((skill) => [Number(skill.id), skill]));

  const visited = new Set<number>();
  const chains: number[][] = [];

  for (const root of generated) {
    const rootId = Number(root.id);

    if (
      visited.has(rootId) ||
      root.type !== 'Weapon' ||
      root.slot !== 'Weapon_1' ||
      !root.weapon ||
      root.nextChainId == null
    ) {
      continue;
    }

    const chain: number[] = [];
    const path = new Set<number>();

    let current: Skill | undefined = root;

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

const AUTOATTACK_CHAINS = Object.freeze([...circularElementalistAutoattackChains(), AERIAL_AGILITY_CHAIN]);

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

/**
 * Builds one module's catalog contribution: the generated skills it owns, its own
 * declared mechanics and extra skills, and the shared trait/specialization data. Core
 * additionally carries the family's weapon data and autoattack chains.
 */
export function createElementalistModuleData(
  id: string,
  { skillMechanics, extraSkills = [], balanceProfiles = [] }: ProfessionModuleDataOptions
) {
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    skillMechanics: finalizedSkillMechanics(skillMechanics),
    extraSkills,
    balanceProfiles,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: ELEMENTALIST_API_SPECIALIZATIONS,
    ...(id === 'Core'
      ? {
          ...WEAPON_DATA,
          autoattackChains: {
            additional: AUTOATTACK_CHAINS
          }
        }
      : {})
  });
}
