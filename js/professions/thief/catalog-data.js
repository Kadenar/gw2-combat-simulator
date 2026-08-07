import { flattenProfessionState } from "../../platform/engine/profession.js";
import { createNativeModuleData } from "../../platform/gw2/native-profession.js";
import { SKILLS, SPECIALIZATIONS } from "./data/thief-api-metadata.js";
import { THIEF_SKILL_IDS as ID } from "./data/ids.js";
import { THIEF_SUPPLEMENTAL_SKILLS } from "./data/thief-supplemental-skills.js";
import { TRAITS } from "./data/traits-data.js";
import { spearChainStageForSkill } from "./core/conditions.js";
import {
  thiefWeaponSkillMatchesSet as thiefCoreWeaponSkillMatchesSet,
} from "./core/weapons.js";

export function thiefWeaponSkillMatchesSet(skill, pair, context = {}) {
  const professionState = flattenProfessionState(
    context.professionState || context.state?.profession || {},
  );
  return thiefCoreWeaponSkillMatchesSet(skill, pair, {
    ...context,
    professionState: {
      ...professionState,
      usesMaliciousStealthAttacks:
        professionState.usesMaliciousStealthAttacks ??
        (context.specialization === "Deadeye" ||
          context.config?.specialization === "Deadeye"),
    },
  });
}

const DUAL_FOLLOWUP_BY_PARENT = Object.freeze({
  13010: 59526,
  13016: 13007,
  63267: 63128,
});
const DUAL_FOLLOWUP_IDS = new Set(Object.values(DUAL_FOLLOWUP_BY_PARENT));
function spearWeaponBarMetadata(skill) {
  const stage = spearChainStageForSkill(skill.id);
  if (stage == null) return {};
  return {
    weaponBarChainRootId: skill.slot === "Weapon_2"
      ? ID.MANTIS_STING
      : ID.UNSUSPECTING_STRIKE,
    weaponBarChainStep: stage + 1,
  };
}
const SIMULATOR_EXCLUDED_SKILL_NAMES = new Set([
  "Prepare Seal Area", "Prepare Shadow Portal", "Seal Area", "Shadow Portal",
  "Shadow Refuge", "Shadow Return", "Shadowstep", "Smoke Screen",
]);
const SIMULATOR_EXCLUDED_ALIAS_IDS = new Set([
  45094, 80278, 76744, 76550, 76601, 76800, 76900, 77288,
]);
const generatedSource = SKILLS
  .filter((skill) =>
    !SIMULATOR_EXCLUDED_SKILL_NAMES.has(skill.name) &&
    !SIMULATOR_EXCLUDED_ALIAS_IDS.has(skill.id))
  .map((skill) => ({
    ...skill,
    flipSkillId: DUAL_FOLLOWUP_BY_PARENT[skill.id] ??
      (["Weapon", "Profession"].includes(skill.type) ? null : skill.flipSkillId),
  }));
const supplementalSource = THIEF_SUPPLEMENTAL_SKILLS.filter((skill) =>
  !SIMULATOR_EXCLUDED_SKILL_NAMES.has(skill.name));
const allDeclared = [...generatedSource, ...supplementalSource];
const declaredIds = new Set(allDeclared.map((skill) => skill.id));
const byId = new Map(allDeclared.map((skill) => [skill.id, skill]));
const flipParentById = new Map();
for (const skill of allDeclared) {
  if (skill.flipSkillId != null && skill.flipSkillId !== skill.nextChainId &&
    byId.has(skill.flipSkillId)) {
    flipParentById.set(skill.flipSkillId, skill.id);
  }
}
const normalize = (skill) => ({
  ...skill,
  ...spearWeaponBarMetadata(skill),
  ...(skill.recharge == null && skill.ammoRecharge == null ? {} : {
    cooldown: skill.ammo > 0
      ? skill.ammoRecharge || skill.recharge
      : skill.recharge,
  }),
  flipParentId: flipParentById.get(skill.id) ?? null,
  dualWieldOpener: Object.hasOwn(DUAL_FOLLOWUP_BY_PARENT, skill.id),
  dualWieldFollowup: DUAL_FOLLOWUP_IDS.has(skill.id),
  ...(Number(skill.initiativeCost || 0) > 0 ? { resource: "initiative" } : {}),
});
const generated = generatedSource.map((skill) => ({
  ...normalize(skill),
  implemented: false,
  effects: [],
}));
const supplemental = supplementalSource.map(normalize);

const SPECIALIZATION_ONLY_SKILLS = Object.freeze({
  Deadeye: [
    ID.DEADEYES_MARK, ID.MALICIOUS_DEATHS_JUDGMENT,
    ID.MALICIOUS_ASHEN_ASSAULT, ID.MALICIOUS_SURPRISE_SHOT,
    ID.MALICIOUS_SNEAK_ATTACK, ID.MALICIOUS_BACKSTAB,
    ID.MALICIOUS_TACTICAL_STRIKE, ID.MALICIOUS_SHADOWSQUALL,
    ID.MALICIOUS_HOOK_STRIKE, ID.MALICIOUS_CUNNING_SALVO,
  ],
  Specter: [ID.ETERNAL_NIGHT, ID.GRASPING_SHADOWS, ID.DAWNS_REPOSE, ID.MIND_SHOCK, ID.HAUNT_SHOT],
  Antiquary: [
    ID.FORGED_SURFER_DASH_ID_76633, ID.HOLO_DANCER_DECOY,
    ID.EXALTED_HAMMER_ID_76702, ID.CHAK_SHIELD,
    ID.ZEPHYRITE_SUN_CRYSTAL, ID.UNSTABLE_SKRITT_BOMB, ID.RESHUFFLE,
    ID.SUMMON_KRYPTIS_TURRET_ID_77192, ID.MISTBURN_MORTAR, ID.SKRITT_SWIPE,
    ID.ZEPHYRITE_SUN_CRYSTAL_ID_78309,
  ],
});
const SPECIALIZATION_ONLY_SKILL_OWNERS = Object.freeze(Object.fromEntries(
  Object.entries(SPECIALIZATION_ONLY_SKILLS).flatMap(([owner, skillIds]) =>
    skillIds.map((skillId) => [String(skillId), owner])
  ),
));
const WEAPONS = Object.freeze([
  "Axe", "Dagger", "Pistol", "Rifle", "Scepter", "Shortbow", "Spear",
  "Staff", "Sword",
]);
const WEAPON_HANDS = Object.freeze({
  Axe: "mh", Dagger: "mh+oh", Pistol: "mh+oh", Rifle: "2h", Scepter: "mh",
  Shortbow: "2h", Spear: "2h", Staff: "2h", Sword: "mh",
});

export function createThiefModuleData(
  id,
  { skillMechanics, extraSkills = [], handlers },
) {
  const terrestrialMechanics = Object.fromEntries(
    Object.entries(skillMechanics)
      .filter(([skillId]) => declaredIds.has(Number(skillId)))
      .map(([skillId, mechanics]) => [skillId, {
        ...mechanics,
        ...(Number(mechanics.initiativeCost || 0) > 0
          ? { resource: "initiative" }
          : {}),
        ...(mechanics.artifactKind
          ? { ignoresStealthWeaponReplacement: true }
          : {}),
      }]),
  );
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    sharedExtraSkills: supplemental,
    skillMechanics: terrestrialMechanics,
    extraSkills,
    handlers,
    traits: TRAITS,
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === "Core" ? { weapons: WEAPONS, weaponHands: WEAPON_HANDS } : {}),
  });
}
