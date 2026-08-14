import { createNativeModuleData } from "../../platform/gw2/native-profession.js";
import {
  SKILLS as ELEMENTALIST_API_SKILLS,
  SPECIALIZATIONS as ELEMENTALIST_API_SPECIALIZATIONS,
} from "./data/elementalist-api-metadata.js";
import { ELEMENTALIST_GENERATED_SKILLS } from "./data/native-skill-data.js";
import { WEAPON_DATA } from "./data/gear-data.js";
import { ELITE_SPECS, SPECIALIZATIONS, TRAITS } from "./data/traits-data.js";
import type {
  CatalogEntity,
  SchedulerRecord,
  Skill,
  SkillEffect,
} from "../../platform/engine/types.js";
import { ELEMENTALIST_SKILL_MECHANICS } from "./mechanics/skill-mechanics.js";

const SPECIALIZATION_ID_BASE = 1_120_000;
const TRAIT_ID_BASE = 1_130_000;
const ELEMENTALIST_FALLBACK_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#40252b"/><text x="32" y="38" text-anchor="middle" fill="#d65c69" font-size="26">E</text></svg>',
  );

const ELEMENTALIST_CONJURE_ACTION_ICONS = Object.freeze({
  "Frost Bow":
    "https://render.guildwars2.com/file/CC6D556B7C3F95C49E54D697CC2B4E79105DC594/103348.png",
  "Lightning Hammer":
    "https://render.guildwars2.com/file/C3DA6AC980062B0A0EEA14CE51393748CFAE01CA/103369.png",
  "Fiery Greatsword":
    "https://render.guildwars2.com/file/EEDA0B1847077DE93DBB0575D44BE0615FBCE728/103328.png",
});

const ELEMENTALIST_BUNDLE_ACTIONS: readonly Skill[] = Object.freeze([
  {
    id: 2662,
    name: "Flame Barrage",
    displayName: "Flame Barrage",
    description:
      "Command your summoned Fire Elemental to unleash a flame barrage.",
    icon: "https://render.guildwars2.com/file/64A5054179704B60614F90964DE1FB3D39AEC972/867446.png",
    type: "Elite",
    weapon: "",
    slot: "Elite",
    specialization: "",
    categories: ["Glyph", "Elemental command"],
    cooldown: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    flipParentId: 1100276,
    flipParent: "Glyph of Elementals",
    castTimeMs: 0,
    slotSelectable: false,
    implemented: true,
    simulatorExcluded: false,
    effects: [],
  },
  {
    id: -31,
    name: "__drop_bundle",
    displayName: "Drop Bundle",
    description: "Drop the currently equipped conjured weapon.",
    icon: "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    type: "Action",
    weapon: "",
    slot: "Action",
    specialization: "",
    categories: ["Bundle"],
    cooldown: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    castTimeMs: 0,
    implemented: true,
    simulatorExcluded: false,
    paletteAction: false,
    effects: [],
  },
  ...["Frost Bow", "Lightning Hammer", "Fiery Greatsword"].map(
    (weapon, index): Skill => ({
      id: -32 - index,
      name: `__pickup_${weapon}`,
      displayName: `Pick up ${weapon}`,
      description: `Pick up the available ${weapon}.`,
      icon: ELEMENTALIST_CONJURE_ACTION_ICONS[
        weapon as keyof typeof ELEMENTALIST_CONJURE_ACTION_ICONS
      ],
      type: "Action",
      weapon: "",
      slot: "Action",
      specialization: "",
      categories: ["Bundle"],
      cooldown: 0,
      ammo: 0,
      ammoRecharge: 0,
      nextChainId: null,
      flipSkillId: null,
      castTimeMs: 300,
      unaffectedByQuickness: true,
      implemented: true,
      simulatorExcluded: false,
      paletteAction: false,
      effects: [],
    }),
  ),
]);

const SKILL_ICON_OVERRIDES = new Map<string, string>([
  [
    "Deploy Jade Sphere (Fire)",
    "https://render.guildwars2.com/file/22CA7C0F420C7F61CEBFA323DF3AADC5EF237475/2491598.png",
  ],
  [
    "Deploy Jade Sphere (Water)",
    "https://render.guildwars2.com/file/6016319AAF18417F0401800EF36C0F18E207FFD5/2491600.png",
  ],
  [
    "Deploy Jade Sphere (Air)",
    "https://render.guildwars2.com/file/07D9C76FEB07BB04B9D07A05D87C09A0A0AE0319/2491594.png",
  ],
  [
    "Deploy Jade Sphere (Earth)",
    "https://render.guildwars2.com/file/97BEF22148DDA3159B4CF6DB18ECFEDE7107710B/2491596.png",
  ],
  [
    "Volcano",
    "https://render.guildwars2.com/file/334EA928E56F38C176A22415DE3ECE144C5FD5BB/3379101.png",
  ],
  [
    "Jökulhlaup",
    "https://render.guildwars2.com/file/48EB1A03297EE4DFA0FE2CA41F0B02B77302060B/3379104.png",
  ],
  [
    "Derecho",
    "https://render.guildwars2.com/file/94F1A894667CA4F3407C57B055F8236804264B1F/3379095.png",
  ],
  [
    "Haboob",
    "https://render.guildwars2.com/file/562F2D0ED67AD8453F9CA60F27DB154F2E7543FC/3379098.png",
  ],
  ["Dodge", "https://wiki.guildwars2.com/images/b/b2/Dodge.png"],
]);
const SKILL_NAME_ALIASES = new Map<string, string>([
  ["Frozen Grounds", "Frozen Ground"],
]);
const API_SKILLS_BY_NAME = new Map(
  ELEMENTALIST_API_SKILLS.map((skill) => [skill.name, skill]),
);
const API_SPECIALIZATIONS_BY_NAME = new Map(
  ELEMENTALIST_API_SPECIALIZATIONS.map((specialization) => [
    specialization.name,
    specialization,
  ]),
);
const API_TRAITS_BY_NAME = new Map(
  ELEMENTALIST_API_SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat(),
  ]).map((trait) => [trait.name, trait]),
);
const SLOT_SKILL_TYPES = new Set(["Heal", "Utility", "Elite"]);
const ATTUNEMENT_VARIANT_PATTERN = /\s*\((?:Fire|Water|Air|Earth)\)$/;
const HAMMER_ORB_PACKET_SKILLS = new Set([
  "Flame Wheel",
  "Icy Coil",
  "Crescent Wind",
  "Rocky Loop",
]);
const HAMMER_ORB_PACKET_COUNT = 15;

export const ELEMENTALIST_SMALL_HITBOX_CAPS: ReadonlyMap<string, number> =
  new Map([
    ["Meteor Shower", 12],
    ["Lightning Orb", 11],
    ["Frost Storm", 14],
    ["Invoke Lightning", 9],
    ["Glyph of Storms (Air)", 20],
    ["Glyph of Storms (Water)", 11],
    ["Dust Storm", 6],
    ["Fiery Whirl", 4],
  ]);

function hitboxMetadata(hitIndex: number, smallHitboxCap: number) {
  return {
    elementalistHitboxIndex: hitIndex,
    elementalistSmallHitboxCap: smallHitboxCap,
  };
}

function withSmallHitboxCap(
  skill: Skill,
  smallHitboxCap: number,
): readonly SkillEffect[] {
  let hitIndex = 0;
  let lastStrikeIndices: number[] = [];
  return (skill.effects || []).map((effect) => {
    if (effect.type === "strike") {
      const hitCount = Array.isArray(effect.ticks)
        ? effect.ticks.length
        : Math.max(1, Math.trunc(Number(effect.hits || 1)));
      lastStrikeIndices = Array.from(
        { length: hitCount },
        () => (hitIndex += 1),
      );
      if (Array.isArray(effect.ticks)) {
        return {
          ...effect,
          ticks: effect.ticks.map((tick, index) => ({
            ...tick,
            metadata: {
              ...(tick.metadata || {}),
              ...hitboxMetadata(lastStrikeIndices[index], smallHitboxCap),
            },
          })),
        };
      }
      if (hitCount !== 1) {
        throw new TypeError(
          `${skill.name} needs individually timed strikes for hitbox caps.`,
        );
      }
      return {
        ...effect,
        metadata: {
          ...(effect.metadata || {}),
          ...hitboxMetadata(lastStrikeIndices[0], smallHitboxCap),
        },
      };
    }

    if (!lastStrikeIndices.length) return effect;
    if (
      Array.isArray(effect.ticks) &&
      effect.ticks.length === lastStrikeIndices.length
    ) {
      return {
        ...effect,
        ticks: effect.ticks.map((tick, index) => ({
          ...tick,
          metadata: {
            ...((tick as SchedulerRecord).metadata as SchedulerRecord),
            ...hitboxMetadata(lastStrikeIndices[index], smallHitboxCap),
          },
        })),
      } as SkillEffect;
    }
    return {
      ...effect,
      metadata: {
        ...(effect.metadata || {}),
        ...hitboxMetadata(
          lastStrikeIndices[lastStrikeIndices.length - 1],
          smallHitboxCap,
        ),
      },
    } as SkillEffect;
  });
}

function withLargeWildfireDuration(skill: Skill): readonly SkillEffect[] {
  return (skill.effects || []).map((effect) => {
    if (effect.type === "strike") {
      return {
        ...effect,
        ticks: [
          ...(effect.ticks || []),
          ...[12840, 14340].map((atMs) => ({
            atMs,
            coefficient: 0.44,
            metadata: {
              damageKind: "field-tick",
              elementalistLargeHitboxOnly: true,
            },
          })),
        ],
      };
    }
    if (effect.type === "condition") {
      return {
        ...effect,
        ticks: [
          ...(effect.ticks || []),
          ...[12840, 14340].map((atMs) => ({
            atMs,
            condition: "Burning",
            stacks: 1,
            duration: 3,
            metadata: { elementalistLargeHitboxOnly: true },
          })),
        ],
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
          atMs: (index + 1) * 1000,
        })),
      } as SkillEffect;
    }),
  };
}

function referenceElementalEffects(skill: Skill): readonly SkillEffect[] {
  return (skill.effects || []).map(
    (effect) => ({ ...effect, timingScale: "fixed" }) as SkillEffect,
  );
}

function withElementalRuntimeProfiles(skill: Skill): Skill {
  if (skill.name !== "Glyph of Elementals") return skill;
  const { quicknessCastTimeMs: _generatedCast, ...withoutGeneratedCast } =
    skill;
  return {
    ...withoutGeneratedCast,
    castTimeMs: 1250,
    cooldown: skill.cooldown,
    referenceEffects: referenceElementalEffects(skill),
    effects: [],
  };
}

function withElementalistHitboxBehavior(skill: Skill): Skill {
  const withHammerPackets = withHammerOrbPackets(skill);
  const withLargeDuration =
    withHammerPackets.name === "Wildfire"
      ? {
          ...withHammerPackets,
          effects: withLargeWildfireDuration(withHammerPackets),
        }
      : withHammerPackets;
  const smallHitboxCap = ELEMENTALIST_SMALL_HITBOX_CAPS.get(
    withHammerPackets.name,
  );
  return smallHitboxCap == null
    ? withLargeDuration
    : {
        ...withLargeDuration,
        effects: withSmallHitboxCap(withLargeDuration, smallHitboxCap),
      };
}

function apiSkill(name: string): Skill | undefined {
  const alias = SKILL_NAME_ALIASES.get(name);
  const base = name.replace(/\s*\(.*\)$/, "");
  const candidates = [
    alias,
    name,
    base,
    `“${name}”`,
    `"${name}"`,
    `${name}!`,
    `“${base}”`,
    `"${base}"`,
  ];
  return candidates
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => API_SKILLS_BY_NAME.get(candidate))
    .find((candidate) => candidate != null);
}

export const ELEMENTALIST_NATIVE_SKILLS: readonly Skill[] = Object.freeze(
  ELEMENTALIST_GENERATED_SKILLS.map(withElementalistHitboxBehavior)
    .map(withElementalRuntimeProfiles)
    .map((skill) => {
      const metadata = apiSkill(skill.name);
      const selectionName = skill.name.replace(ATTUNEMENT_VARIANT_PATTERN, "");
      const isAttunementSlotVariant =
        SLOT_SKILL_TYPES.has(String(skill.type)) &&
        Boolean(skill.attunement) &&
        selectionName !== skill.name;
      return {
        ...skill,
        ...(skill.type === "Weapon" &&
        String(skill.attunement || "").includes("+")
          ? { specialization: "Weaver" }
          : {}),
        ...(isAttunementSlotVariant
          ? {
              displayName: selectionName,
            }
          : {}),
        ...(skill.name === "Tailored Victory" ? { slotSelectable: false } : {}),
        ...(skill.name === "Dodge" ? { paletteAction: true } : {}),
        ...(metadata?.description ? { description: metadata.description } : {}),
        ...(skill.name === "Glyph of Elementals"
          ? {
              description:
                "Glyph. Summon a Fire Elemental regardless of attunement.",
            }
          : {}),
        icon:
          SKILL_ICON_OVERRIDES.get(skill.name) ||
          metadata?.icon ||
          ELEMENTALIST_FALLBACK_ICON,
      };
    }),
);

function circularElementalistAutoattackChains(): readonly (readonly number[])[] {
  const skillsById = new Map(
    ELEMENTALIST_NATIVE_SKILLS.map((skill) => [Number(skill.id), skill]),
  );
  const visited = new Set<number>();
  const chains: number[][] = [];
  for (const root of ELEMENTALIST_NATIVE_SKILLS) {
    const rootId = Number(root.id);
    if (
      visited.has(rootId) ||
      root.type !== "Weapon" ||
      root.slot !== "Weapon_1" ||
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
      current =
        current.nextChainId == null
          ? undefined
          : skillsById.get(Number(current.nextChainId));
    }
    for (const id of path) visited.add(id);
    if (current?.id === root.id && chain.length > 1) chains.push(chain);
  }
  return Object.freeze(chains.map((chain) => Object.freeze(chain)));
}

export const ELEMENTALIST_AUTOATTACK_CHAINS =
  circularElementalistAutoattackChains();

const TRAIT_TIERS = Object.freeze({
  "Minor Adept": 1,
  "Major Adept": 1,
  "Minor Master": 2,
  "Major Master": 2,
  "Minor Grandmaster": 3,
  "Major Grandmaster": 3,
} as const);

export const ELEMENTALIST_TRAITS: readonly CatalogEntity[] = Object.freeze(
  TRAITS.map((trait, index) => {
    const metadata = API_TRAITS_BY_NAME.get(trait.name);
    return {
      ...metadata,
      ...trait,
      id: metadata?.id || TRAIT_ID_BASE + index + 1,
      icon: metadata?.icon || ELEMENTALIST_FALLBACK_ICON,
      tier: TRAIT_TIERS[trait.tier as keyof typeof TRAIT_TIERS],
      slot: trait.position === 0 ? "Minor" : "Major",
    };
  }),
);

export const ELEMENTALIST_SPECIALIZATIONS: readonly CatalogEntity[] =
  Object.freeze(
    SPECIALIZATIONS.map((name, index) => {
      const metadata = API_SPECIALIZATIONS_BY_NAME.get(name);
      const traits = ELEMENTALIST_TRAITS.filter(
        (trait) => trait.specialization === name,
      );
      return {
        id: metadata?.id || SPECIALIZATION_ID_BASE + index + 1,
        name,
        elite: ELITE_SPECS.has(name),
        icon: metadata?.icon || ELEMENTALIST_FALLBACK_ICON,
        background: metadata?.background || "",
        minorTraits: traits.filter((trait) => trait.position === 0),
        majorTraits: [1, 2, 3].map((tier) =>
          traits.filter(
            (trait) => trait.tier === tier && Number(trait.position) > 0,
          ),
        ),
      };
    }),
  );

export const ELEMENTALIST_WEAPONS = Object.freeze(
  Object.keys(WEAPON_DATA).filter(
    (name) => name !== "Unequipped" && name !== "Profession mechanic",
  ),
);

export const ELEMENTALIST_WEAPON_HANDS = Object.freeze(
  Object.fromEntries(
    ELEMENTALIST_WEAPONS.map((name) => [
      name,
      (WEAPON_DATA as Readonly<Record<string, { wielding: string }>>)[name]
        .wielding,
    ]),
  ),
);

export function createElementalistModuleData(id: string) {
  return createNativeModuleData({
    id,
    generatedSkills: ELEMENTALIST_NATIVE_SKILLS,
    ...(id === "Core" ? { skillMechanics: ELEMENTALIST_SKILL_MECHANICS } : {}),
    traits: ELEMENTALIST_TRAITS,
    specializations: ELEMENTALIST_SPECIALIZATIONS,
    ...(id === "Core" ? { extraSkills: ELEMENTALIST_BUNDLE_ACTIONS } : {}),
    ...(id === "Core"
      ? {
          weapons: ELEMENTALIST_WEAPONS,
          weaponHands: ELEMENTALIST_WEAPON_HANDS,
          autoattackChains: {
            additional: ELEMENTALIST_AUTOATTACK_CHAINS,
          },
        }
      : {}),
  });
}
