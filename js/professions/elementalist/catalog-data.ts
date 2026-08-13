import { createNativeModuleData } from "../../platform/gw2/native-profession.js";
import {
  SKILLS as ELEMENTALIST_API_SKILLS,
  SPECIALIZATIONS as ELEMENTALIST_API_SPECIALIZATIONS,
} from "./data/elementalist-api-metadata.js";
import { ELEMENTALIST_GENERATED_SKILLS } from "./data/native-skill-data.js";
import { WEAPON_DATA } from "./data/gear-data.js";
import { ELITE_SPECS, SPECIALIZATIONS, TRAITS } from "./data/traits-data.js";
import type { CatalogEntity, Skill } from "../../platform/engine/types.js";
import { ELEMENTALIST_SKILL_MECHANICS } from "./mechanics/skill-mechanics.js";

const SPECIALIZATION_ID_BASE = 1_120_000;
const TRAIT_ID_BASE = 1_130_000;
const ELEMENTALIST_FALLBACK_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#40252b"/><text x="32" y="38" text-anchor="middle" fill="#d65c69" font-size="26">E</text></svg>',
  );

const SKILL_ICON_OVERRIDES = new Map<string, string>([
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
  ELEMENTALIST_GENERATED_SKILLS.map((skill) => {
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
      ...(metadata?.description ? { description: metadata.description } : {}),
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
    skillMechanics: ELEMENTALIST_SKILL_MECHANICS,
    traits: ELEMENTALIST_TRAITS,
    specializations: ELEMENTALIST_SPECIALIZATIONS,
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
