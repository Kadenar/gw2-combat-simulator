import { createNativeModuleData } from "../../platform/gw2/native-profession.js";
import { SKILLS, SPECIALIZATIONS } from "./data/guardian-api-metadata.js";
import { GUARDIAN_BUNDLE_SKILLS } from "./data/guardian-bundle-skills.js";
import { GUARDIAN_SKILL_IDS as ID } from "./data/ids.js";
import { TRAITS } from "./data/traits-data.js";
import type {
  CatalogEntity,
  Skill,
  SkillFragment,
  SkillId,
  SkillHandlerStrategy,
} from "../../platform/engine/types.js";
import type { NativeAutoattackChains } from "../../platform/gw2/native-profession.js";
import type { GuardianSkill } from "./types.js";

export const GUARDIAN_NON_DPS_SKILL_NAMES = Object.freeze(
  new Set([
    '"Advance!"',
    '"Save Yourselves!"',
    '"Hold the Line!"',
    "Signet of Mercy",
    "Merciful Intervention",
    "Wall of Reflection",
    "Contemplation of Purity",
    '"Stand Your Ground!"',
    "Valorous Stance",
    "Stalwart Stance",
    "Mantra of Lore",
    "Hallowed Ground",
    "Bow of Truth",
  ]),
);

const allSkills: readonly GuardianSkill[] = Object.freeze([
  ...SKILLS,
  ...GUARDIAN_BUNDLE_SKILLS,
]);
const generatedById = new Map(allSkills.map((skill) => [skill.id, skill]));
const flipParentById = new Map<SkillId, SkillId>();
const firebrandFinalFlipByNormalId = new Map<SkillId, SkillId>([
  [ID.RESTORING_REPRIEVE, ID.REJUVENATING_RESPITE],
  [ID.FLAME_RUSH, ID.FLAME_SURGE],
  [ID.POTENT_HASTE, ID.OVERWHELMING_CELERITY],
  [ID.PORTENT_OF_FREEDOM, ID.UNHINDERED_DELIVERY],
]);
for (const skill of allSkills) {
  if (
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    skill.flipSkillId !== ID.GLACIAL_BLOW &&
    generatedById.has(skill.flipSkillId) &&
    generatedById.get(skill.flipSkillId)?.name !== skill.name &&
    !generatedById.get(skill.flipSkillId)?.categories?.includes("Virtue")
  ) {
    flipParentById.set(skill.flipSkillId, skill.id);
  }
}
for (const [normalId, finalId] of firebrandFinalFlipByNormalId) {
  flipParentById.set(finalId, normalId);
}

const generated: readonly Skill[] = allSkills.map((skill) => {
  const flipParentId = flipParentById.get(skill.id);
  return {
    ...skill,
    flipSkillId:
      firebrandFinalFlipByNormalId.get(skill.id) ?? skill.flipSkillId,
    cooldown:
      Number(skill.ammo || 0) > 0
        ? skill.ammoRecharge || skill.recharge
        : skill.recharge,
    flipParentId: flipParentId ?? null,
    flipParent:
      flipParentId == null ? "" : generatedById.get(flipParentId)?.name || "",
    simulatorExcluded: GUARDIAN_NON_DPS_SKILL_NAMES.has(skill.name),
    implemented: false,
    effects: [],
  };
});

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> =
  Object.freeze({
    Dragonhunter: [ID.SPEAR_OF_JUSTICE, ID.HUNTERS_VERDICT],
    Firebrand: [
      ID.STOW_TOME,
      ID.TOME_OF_RESOLVE,
      ID.TOME_OF_COURAGE,
      ID.TOME_OF_COURAGE_ID_42371,
      ID.TOME_OF_JUSTICE,
      ID.TOME_OF_JUSTICE_ID_68647,
      ID.TOME_OF_RESOLVE_ID_68648,
      ID.TOME_OF_COURAGE_ID_68650,
    ],
    Willbender: [
      ID.WILLBENDER_FLAMES,
      ID.WILLBENDER_FLAMES_ID_62618,
      ID.CRASHING_COURAGE,
      ID.CRASHING_COURAGE_ID_62648,
      ID.FLOWING_RESOLVE,
      ID.RUSHING_JUSTICE,
    ],
    Luminary: [
      ID.EXIT_RADIANT_FORGE,
      ID.ENTER_RADIANT_FORGE,
      ID.RADIANT_COURAGE,
      ID.RADIANT_COURAGE_ID_78770,
      ID.RADIANT_RESOLVE,
      ID.RADIANT_RESOLVE_ID_78604,
      ID.RADIANT_JUSTICE,
    ],
  });
const SPECIALIZATION_ONLY_SKILL_OWNERS = Object.freeze(
  Object.fromEntries(
    Object.entries(SPECIALIZATION_ONLY_SKILLS).flatMap(([owner, skillIds]) =>
      skillIds.map((skillId) => [String(skillId), owner]),
    ),
  ),
);

const WEAPONS = Object.freeze([
  "Axe",
  "Focus",
  "Greatsword",
  "Hammer",
  "Longbow",
  "Mace",
  "Pistol",
  "Scepter",
  "Shield",
  "Spear",
  "Staff",
  "Sword",
  "Torch",
]);
const WEAPON_HANDS = Object.freeze({
  Axe: "mh",
  Focus: "oh",
  Greatsword: "2h",
  Hammer: "2h",
  Longbow: "2h",
  Mace: "mh",
  Pistol: "mh+oh",
  Scepter: "mh",
  Shield: "oh",
  Spear: "2h",
  Staff: "2h",
  Sword: "mh+oh",
  Torch: "oh",
});

interface GuardianModuleDataOptions<TContext extends object> {
  readonly skillMechanics: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly handlers?:
    | ReadonlyMap<string, SkillHandlerStrategy<TContext>>
    | Readonly<Record<string, SkillHandlerStrategy<TContext>>>;
  readonly autoattackChains?: NativeAutoattackChains;
}

export function createGuardianModuleData<TContext extends object>(
  id: string,
  {
    skillMechanics,
    extraSkills = [],
    handlers,
    autoattackChains,
  }: GuardianModuleDataOptions<TContext>,
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
