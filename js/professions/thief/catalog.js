import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import {
  defineCatalogOwnership,
} from "../../platform/engine/catalog-ownership.js";
import { flattenProfessionState } from "../../platform/engine/profession.js";
import {
  SKILLS,
  SPECIALIZATIONS,
} from "./data/thief-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import {
  THIEF_SUPPLEMENTAL_SKILLS,
} from "./data/thief-supplemental-skills.js";
import {
  THIEF_SKILL_IDS as ID,
} from "./data/ids.js";
import {
  THIEF_EXTRA_SKILLS,
  THIEF_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import {
  thiefSkillHandlers,
} from "./handlers.js";
import {
  spearChainStageForSkill,
} from "./core/conditions.js";
import {
  thiefWeaponSkillMatchesSet as thiefCoreWeaponSkillMatchesSet,
} from "./core/weapons.js";

export function thiefWeaponSkillMatchesSet(skill, pair, context = {}) {
  const professionState = flattenProfessionState(
    context.professionState
    || context.state?.profession
    || {},
  );
  return thiefCoreWeaponSkillMatchesSet(skill, pair, {
    ...context,
    professionState: {
      ...professionState,
      usesMaliciousStealthAttacks:
        professionState.usesMaliciousStealthAttacks
        ?? (
          context.specialization === "Deadeye"
          || context.config?.specialization === "Deadeye"
        ),
    },
  });
}

const DUAL_FOLLOWUP_BY_PARENT = Object.freeze({
  13010: 59526, // Shadow Strike -> Repeater
  13016: 13007, // Flanking Strike -> Larcenous Strike
  63267: 63128, // Measured Shot -> Endless Night
});
const DUAL_FOLLOWUP_IDS = new Set(
  Object.values(DUAL_FOLLOWUP_BY_PARENT),
);
function spearWeaponBarMetadata(skill) {
  const stage = spearChainStageForSkill(skill.id);
  if (stage == null) return {};
  return {
    weaponBarChainRootId:
      skill.slot === "Weapon_2"
        ? ID.MANTIS_STING
        : ID.UNSUSPECTING_STRIKE,
    weaponBarChainStep: stage + 1,
  };
}
const SIMULATOR_EXCLUDED_SKILL_NAMES = new Set([
  "Prepare Seal Area",
  "Prepare Shadow Portal",
  "Seal Area",
  "Shadow Portal",
  "Shadow Refuge",
  "Shadow Return",
  "Shadowstep",
  "Smoke Screen",
]);
const SIMULATOR_EXCLUDED_ALIAS_IDS = new Set([
  45094, // Throw Gunk mode alias
  80278, // Death's Advance mode alias
  76744, // Canach-Coin Toss backfire alias
  76550, // Forged Surfer Dash mode alias
  76601, // Exalted Hammer mode alias
  76800, // Holo-Dancer Decoy mode alias
  76900, // Summon Kryptis Turret mode alias
  77288, // Mistburn Mortar mode alias
]);
const generatedSource = SKILLS
  .filter(skill =>
    !SIMULATOR_EXCLUDED_SKILL_NAMES.has(skill.name)
    && !SIMULATOR_EXCLUDED_ALIAS_IDS.has(skill.id))
  .map(skill => ({
    ...skill,
    flipSkillId:
      DUAL_FOLLOWUP_BY_PARENT[skill.id]
      ?? (
        // Profession-slot API links describe specialization replacements
        // (Steal/Skritt Swipe -> Deadeye's Mark), not live skill flips.
        ["Weapon", "Profession"].includes(skill.type)
          ? null
          : skill.flipSkillId
      ),
  }));
const supplementalSource = THIEF_SUPPLEMENTAL_SKILLS.filter(skill =>
  !SIMULATOR_EXCLUDED_SKILL_NAMES.has(skill.name));
const allDeclared = [...generatedSource, ...supplementalSource];
const declaredIds = new Set(allDeclared.map(skill => skill.id));
const terrestrialMechanics = Object.fromEntries(
  Object.entries(THIEF_SKILL_MECHANICS)
    .filter(([id]) => declaredIds.has(Number(id)))
    .map(([id, mechanics]) => [
      id,
      {
        ...mechanics,
        ...(
          Number(mechanics.initiativeCost || 0) > 0
            ? { resource: "initiative" }
            : {}
        ),
        ...(
          mechanics.artifactKind
            ? { ignoresStealthWeaponReplacement: true }
            : {}
        ),
      },
    ]),
);
const byId = new Map(allDeclared.map(skill => [skill.id, skill]));
const flipParentById = new Map();
for (const skill of allDeclared) {
  if (
    skill.flipSkillId != null
    && skill.flipSkillId !== skill.nextChainId
    && byId.has(skill.flipSkillId)
  ) flipParentById.set(skill.flipSkillId, skill.id);
}
const normalize = skill => ({
  ...skill,
  ...spearWeaponBarMetadata(skill),
  ...(
    skill.recharge == null && skill.ammoRecharge == null
      ? {}
      : {
        cooldown:
          skill.ammo > 0 ? skill.ammoRecharge || skill.recharge : skill.recharge,
      }
  ),
  flipParentId: flipParentById.get(skill.id) ?? null,
  dualWieldOpener: Object.hasOwn(DUAL_FOLLOWUP_BY_PARENT, skill.id),
  dualWieldFollowup: DUAL_FOLLOWUP_IDS.has(skill.id),
  ...(
    Number(skill.initiativeCost || 0) > 0
      ? { resource: "initiative" }
      : {}
  ),
});
const generated = generatedSource.map(skill => ({
  ...normalize(skill),
  implemented: false,
  effects: [],
}));
const supplemental = supplementalSource.map(normalize);

export const thiefCatalog = createCanonicalCatalog({
  generated,
  mechanics: terrestrialMechanics,
  extraSkills: [...supplemental, ...THIEF_EXTRA_SKILLS],
  skillHandlers: thiefSkillHandlers,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  weapons: [
    "Axe",
    "Dagger",
    "Pistol",
    "Rifle",
    "Scepter",
    "Shortbow",
    "Spear",
    "Staff",
    "Sword",
  ],
  weaponHands: {
    Axe: "mh",
    Dagger: "mh+oh",
    Pistol: "mh+oh",
    Rifle: "2h",
    Scepter: "mh",
    Shortbow: "2h",
    Spear: "2h",
    Staff: "2h",
    Sword: "mh",
  },
});
export const THIEF_SKILLS = thiefCatalog.skills;

export const THIEF_ELITE_SPECIALIZATIONS = Object.freeze([
  "Daredevil",
  "Deadeye",
  "Specter",
  "Antiquary",
]);

export const thiefCatalogOwnership = defineCatalogOwnership({
  catalog: thiefCatalog,
  modules: ["Core", ...THIEF_ELITE_SPECIALIZATIONS],
  skillOverrides: {
    [ID.DEADEYES_MARK]: "Deadeye",
    [ID.MALICIOUS_DEATHS_JUDGMENT]: "Deadeye",
    [ID.MALICIOUS_ASHEN_ASSAULT]: "Deadeye",
    [ID.MALICIOUS_SURPRISE_SHOT]: "Deadeye",
    [ID.MALICIOUS_SNEAK_ATTACK]: "Deadeye",
    [ID.MALICIOUS_BACKSTAB]: "Deadeye",
    [ID.MALICIOUS_TACTICAL_STRIKE]: "Deadeye",
    [ID.MALICIOUS_SHADOWSQUALL]: "Deadeye",
    [ID.MALICIOUS_HOOK_STRIKE]: "Deadeye",
    [ID.MALICIOUS_CUNNING_SALVO]: "Deadeye",
    [ID.ETERNAL_NIGHT]: "Specter",
    [ID.GRASPING_SHADOWS]: "Specter",
    [ID.DAWNS_REPOSE]: "Specter",
    [ID.MIND_SHOCK]: "Specter",
    [ID.HAUNT_SHOT]: "Specter",
    [ID.FORGED_SURFER_DASH_ID_76633]: "Antiquary",
    [ID.HOLO_DANCER_DECOY]: "Antiquary",
    [ID.EXALTED_HAMMER_ID_76702]: "Antiquary",
    [ID.CHAK_SHIELD]: "Antiquary",
    [ID.ZEPHYRITE_SUN_CRYSTAL]: "Antiquary",
    [ID.UNSTABLE_SKRITT_BOMB]: "Antiquary",
    [ID.RESHUFFLE]: "Antiquary",
    [ID.SUMMON_KRYPTIS_TURRET_ID_77192]: "Antiquary",
    [ID.MISTBURN_MORTAR]: "Antiquary",
    [ID.SKRITT_SWIPE]: "Antiquary",
    [ID.ZEPHYRITE_SUN_CRYSTAL_ID_78309]: "Antiquary",
  },
  handlerOwners: {
    "thief.deadeyes-mark": "Deadeye",
    "thief.deadeye-spear-stealth-attack": "Deadeye",
    "thief.siphon": "Specter",
    "thief.shadow-shroud-enter": "Specter",
    "thief.shadow-shroud-exit": "Specter",
    "thief.skritt-swipe": "Antiquary",
    "thief.artifact": "Antiquary",
    "thief.forged-surfer": "Antiquary",
    "thief.reshuffle": "Antiquary",
    "thief.double-edge": "Antiquary",
    "thief.skritt-scuffle": "Antiquary",
  },
  core: { ownsWeapons: true },
});

export function thiefSkillRuntimeOwner(skill) {
  return thiefCatalogOwnership.skillOwners.get(skill.id) || "Core";
}

export const thiefModuleCatalog = thiefCatalogOwnership.fragment;
