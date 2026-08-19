import { createNativeModuleData } from '../../platform/gw2/native-profession.js';
import {
  SKILLS as ELEMENTALIST_API_SKILLS,
  SPECIALIZATIONS as ELEMENTALIST_API_SPECIALIZATIONS
} from './data/elementalist-api-metadata.js';
import { ELEMENTALIST_SKILL_IDS as ID } from './data/ids.js';
import { ELEMENTALIST_API_SKILL_ID_OVERRIDES, ELEMENTALIST_LOADOUT_SKILL_IDS } from './data/skill-identities.js';
import { TRAITS } from './data/traits-data.js';
import type {
  BalanceProfile,
  CatalogEntity,
  SchedulerRecord,
  Skill,
  SkillEffect,
  SkillFragment,
  SkillHandlerStrategy
} from '../../platform/engine/types.js';
import type { ElementalistCastContext } from './types.js';
import { ELEMENTALIST_SKILL_MECHANICS } from './mechanics/skill-mechanics.js';

const ELEMENTALIST_FALLBACK_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#40252b"/><text x="32" y="38" text-anchor="middle" fill="#d65c69" font-size="26">E</text></svg>'
  );

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
const SKILL_NAME_ALIASES = new Map<string, string>([['Frozen Grounds', 'Frozen Ground']]);
const API_SKILLS_BY_NAME = new Map(ELEMENTALIST_API_SKILLS.map((skill) => [skill.name, skill]));
const API_SKILLS_BY_ID = new Map(ELEMENTALIST_API_SKILLS.map((skill) => [Number(skill.id), skill]));
const SLOT_SKILL_TYPES = new Set(['Heal', 'Utility', 'Elite']);
const ATTUNEMENT_VARIANT_PATTERN = /\s*\((?:Fire|Water|Air|Earth)\)$/;
const HAMMER_ORB_PACKET_SKILLS = new Set(['Flame Wheel', 'Icy Coil', 'Crescent Wind', 'Rocky Loop']);
const HAMMER_ORB_PACKET_COUNT = 15;

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

/**
 * Numbers correlated strike and condition packets so a target-size rule can
 * exclude every packet above the skill's small-hitbox cap.
 */
function hitboxMetadata(hitIndex: number, smallHitboxCap: number) {
  return {
    hitboxIndex: hitIndex,
    smallHitboxCap
  };
}

function withSmallHitboxCap(skill: Skill, smallHitboxCap: number): readonly SkillEffect[] {
  let hitIndex = 0;
  let lastStrikeIndices: number[] = [];
  return (skill.effects || []).map((effect) => {
    if (effect.type === 'strike') {
      const hitCount = Array.isArray(effect.ticks)
        ? effect.ticks.length
        : Math.max(1, Math.trunc(Number(effect.hits || 1)));
      lastStrikeIndices = Array.from({ length: hitCount }, () => (hitIndex += 1));
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

    if (!lastStrikeIndices.length) return effect;
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

function withLargeWildfireDuration(skill: Skill): readonly SkillEffect[] {
  return (skill.effects || []).map((effect) => {
    if (effect.type === 'strike') {
      return {
        ...effect,
        ticks: [
          ...(effect.ticks || []),
          ...[12840, 14340].map((atMs) => ({
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
          ...[12840, 14340].map((atMs) => ({
            atMs,
            condition: 'Burning',
            stacks: 1,
            duration: 3,
            metadata: { largeHitboxOnly: true }
          }))
        ]
      };
    }

    return effect;
  });
}

function withHammerOrbPackets(skill: Skill): Skill {
  if (!HAMMER_ORB_PACKET_SKILLS.has(skill.name)) return skill;
  return {
    ...skill,
    effects: (skill.effects || []).map((effect) => {
      if (!Array.isArray(effect.ticks) || effect.ticks.length !== 1) {
        return effect;
      }

      const [packet] = effect.ticks;
      return {
        ...effect,
        ticks: Array.from({ length: HAMMER_ORB_PACKET_COUNT }, (_, index) => ({
          ...packet,
          atMs: (index + 1) * 1000
        }))
      } as SkillEffect;
    })
  };
}

function withElementalRuntimeProfiles(skill: Skill): Skill {
  if (!skill.name.startsWith('Glyph of Elementals')) return skill;
  const { quicknessCastTimeMs: _generatedCast, ...withoutGeneratedCast } = skill;
  return {
    ...withoutGeneratedCast,
    castTimeMs: 1250,
    cooldown: skill.cooldown,
    effects: []
  };
}

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

function apiSkill(name: string): Skill | undefined {
  const alias = SKILL_NAME_ALIASES.get(name);
  const base = name.replace(/\s*\(.*\)$/, '');
  const candidates = [alias, name, base, `“${name}”`, `"${name}"`, `${name}!`, `“${base}”`, `"${base}"`];
  return candidates
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => API_SKILLS_BY_NAME.get(candidate))
    .find((candidate) => candidate != null);
}

const ELEMENTALIST_DECLARED_SKILLS: readonly Skill[] = Object.freeze(
  Object.values(ID).flatMap((id) => {
    const declaration = ELEMENTALIST_SKILL_MECHANICS[id];
    return declaration ? [{ ...declaration, id } as Skill] : [];
  })
);

const generated: readonly Skill[] = Object.freeze(
  ELEMENTALIST_DECLARED_SKILLS.map(withElementalistHitboxBehavior)
    .map(withElementalRuntimeProfiles)
    .map((skill) => {
      // Stable IDs are the authoritative metadata join. Explicit roots retain
      // metadata for simulator-only or attunement-specific projections.
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
          ? { specialization: 'Weaver' }
          : {}),
        ...(isAttunementSlotVariant
          ? {
              displayName: selectionName
            }
          : {}),
        ...(skill.name === 'Tailored Victory' ? { slotSelectable: false } : {}),
        ...(skill.name === 'Dodge' ? { paletteAction: true } : {}),
        ...(metadata?.description ? { description: metadata.description } : {}),
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

    for (const id of path) visited.add(id);
    if (current?.id === root.id && chain.length > 1) chains.push(chain);
  }

  return Object.freeze(chains.map((chain) => Object.freeze(chain)));
}

// Aerial Agility is a genuine three-step pistol chain rather than a slot-1
// autoattack, so circularElementalistAutoattackChains (Weapon_1 only, to skip
// the two-skill aura/transmute flips) never derives it. Declaring it explicitly
// gives its stages a chainRoot/chainStep, which collapses them to one palette
// tile and shares the in-order gating and reset-on-other-skill behavior the
// dps-report reconstruction already models for the chain.
const AERIAL_AGILITY_CHAIN = Object.freeze(
  [ID.AERIAL_AGILITY, ID.AERIAL_AGILITY_CHAIN, ID.AERIAL_AGILITY_DASH].map(Number)
);
const AUTOATTACK_CHAINS = Object.freeze([...circularElementalistAutoattackChains(), AERIAL_AGILITY_CHAIN]);

const WEAPONS = Object.freeze(['Dagger', 'Focus', 'Hammer', 'Pistol', 'Scepter', 'Spear', 'Staff', 'Sword', 'Warhorn']);
const WEAPON_HANDS = Object.freeze({
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

interface ElementalistModuleDataOptions<TContext extends object> {
  readonly skillMechanics: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly handlers?:
    ReadonlyMap<string, SkillHandlerStrategy<TContext>> | Readonly<Record<string, SkillHandlerStrategy<TContext>>>;
}

export function createElementalistModuleData<TContext extends object = ElementalistCastContext>(
  id: string,
  { skillMechanics, extraSkills = [], balanceProfiles = [], handlers }: ElementalistModuleDataOptions<TContext>
) {
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    skillMechanics: finalizedSkillMechanics(skillMechanics),
    extraSkills,
    balanceProfiles,
    handlers,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: ELEMENTALIST_API_SPECIALIZATIONS,
    ...(id === 'Core'
      ? {
          weapons: WEAPONS,
          weaponHands: WEAPON_HANDS,
          autoattackChains: {
            additional: AUTOATTACK_CHAINS
          }
        }
      : {})
  });
}
