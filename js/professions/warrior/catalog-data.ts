import { createNativeModuleData } from "../../platform/gw2/native-profession.js";
import { SKILLS, SPECIALIZATIONS } from "./data/warrior-api-metadata.js";
import { WARRIOR_SUPPLEMENTAL_SKILLS } from "./data/warrior-supplemental-skills.js";
import { TRAITS } from "./data/traits-data.js";
import { WARRIOR_CORE_SKILL_MECHANICS } from "./core/skills.js";
import { BERSERKER_SKILL_MECHANICS } from "./specializations/berserker/skills.js";
import { SPELLBREAKER_SKILL_MECHANICS } from "./specializations/spellbreaker/skills.js";
import { BLADESWORN_SKILL_MECHANICS } from "./specializations/bladesworn/skills.js";
import { PARAGON_SKILL_MECHANICS } from "./specializations/paragon/skills.js";
import type {
  CatalogEntity,
  Skill,
  SkillFragment,
  SkillHandlerStrategy,
  SkillId,
} from "../../platform/engine/types.js";
import type { NativeAutoattackChains } from "../../platform/gw2/native-profession.js";

export const WARRIOR_NON_DPS_SKILL_NAMES = Object.freeze(new Set<string>());

const WARRIOR_SIMULATOR_EXCLUDED_SKILL_IDS = new Set<number>([
  14372, // "Shake It Off!"
  14392, // Endure Pain
  14406, // Berserker Stance
  14408, // Banner of Tactics
  14409, // "Fear Me!"
  14412, // Balanced Stance
  14528, // Banner of Defense
  14575, // "On My Mark!"
  41919, // Imminent Threat
  43745, // Sight beyond Sight
  45380, // Featherfoot Grace
  62804, // Electric Fence
]);

const allSkills: readonly Skill[] = Object.freeze([
  ...SKILLS.filter((skill) => !/^\(\(/.test(String(skill.name || ""))),
  ...WARRIOR_SUPPLEMENTAL_SKILLS,
]);
const byId = new Map(allSkills.map((skill) => [skill.id, skill]));
const canonicalIdByName = new Map<string, SkillId>();
for (const skill of [...allSkills].sort(
  (left, right) => Number(left.id) - Number(right.id),
)) {
  if (!canonicalIdByName.has(skill.name))
    canonicalIdByName.set(skill.name, skill.id);
}
const flipParentById = new Map<SkillId, SkillId>();
for (const skill of allSkills) {
  if (
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    byId.has(skill.flipSkillId)
  ) {
    flipParentById.set(skill.flipSkillId, skill.id);
  }
}
const generated: readonly Skill[] = Object.freeze(
  allSkills.map((skill) => {
    const canonicalId = canonicalIdByName.get(skill.name)!;
    return {
      ...skill,
      cooldown:
        Number(skill.ammo || 0) > 0
          ? Number(skill.ammoRecharge || skill.recharge || 0)
          : Number(skill.recharge || 0),
      flipParentId: flipParentById.get(skill.id) ?? null,
      simulatorAliasOfId: canonicalId === skill.id ? null : canonicalId,
      simulatorExcluded:
        canonicalId !== skill.id ||
        WARRIOR_SIMULATOR_EXCLUDED_SKILL_IDS.has(Number(skill.id)),
      implemented: false,
      effects: [],
    };
  }),
);

const SPECIALIZATION_MECHANICS = Object.freeze({
  Berserker: BERSERKER_SKILL_MECHANICS,
  Spellbreaker: SPELLBREAKER_SKILL_MECHANICS,
  Bladesworn: BLADESWORN_SKILL_MECHANICS,
  Paragon: PARAGON_SKILL_MECHANICS,
});
const SPECIALIZATION_ONLY_SKILLS = Object.freeze(
  Object.fromEntries(
    Object.entries(SPECIALIZATION_MECHANICS).map(([owner, mechanics]) => [
      owner,
      Object.freeze(Object.keys(mechanics).map(Number)),
    ]),
  ),
);
const SPECIALIZATION_ONLY_SKILL_OWNERS = Object.freeze(
  Object.fromEntries(
    Object.entries(SPECIALIZATION_ONLY_SKILLS).flatMap(([owner, ids]) =>
      ids.map((id) => [String(id), owner]),
    ),
  ),
);
const WEAPONS = Object.freeze([
  "Axe",
  "Dagger",
  "Greatsword",
  "Hammer",
  "Longbow",
  "Mace",
  "Pistol",
  "Rifle",
  "Shield",
  "Spear",
  "Staff",
  "Sword",
  "Torch",
  "Warhorn",
]);
const WEAPON_HANDS = Object.freeze({
  Axe: "mh+oh",
  Dagger: "mh+oh",
  Greatsword: "2h",
  Hammer: "2h",
  Longbow: "2h",
  Mace: "mh+oh",
  Pistol: "oh",
  Rifle: "2h",
  Shield: "oh",
  Spear: "2h",
  Staff: "2h",
  Sword: "mh+oh",
  Torch: "oh",
  Warhorn: "oh",
});

interface WarriorModuleDataOptions<TContext extends object> {
  readonly skillMechanics: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly handlers?:
    | ReadonlyMap<string, SkillHandlerStrategy<TContext>>
    | Readonly<Record<string, SkillHandlerStrategy<TContext>>>;
  readonly autoattackChains?: NativeAutoattackChains;
}

export function createWarriorModuleData<TContext extends object>(
  id: string,
  {
    skillMechanics,
    extraSkills = [],
    handlers,
    autoattackChains,
  }: WarriorModuleDataOptions<TContext>,
) {
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    skillMechanics,
    extraSkills,
    handlers,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === "Core" ? { weapons: WEAPONS, weaponHands: WEAPON_HANDS } : {}),
    ...(autoattackChains ? { autoattackChains } : {}),
  });
}

export { WARRIOR_CORE_SKILL_MECHANICS };
