import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import {
  SKILLS,
  SPECIALIZATIONS,
} from "./data/thief-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import {
  THIEF_SUPPLEMENTAL_SKILLS,
} from "./data/thief-supplemental-skills.js";
import {
  THIEF_EXTRA_SKILLS,
  THIEF_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import {
  thiefSkillHandlers,
} from "./mechanics/specific/handlers.js";

const DUAL_FOLLOWUP_BY_PARENT = Object.freeze({
  13010: 59526, // Shadow Strike -> Repeater
  13016: 13007, // Flanking Strike -> Larcenous Strike
  63267: 63128, // Measured Shot -> Endless Night
});
const DUAL_FOLLOWUP_IDS = new Set(
  Object.values(DUAL_FOLLOWUP_BY_PARENT),
);
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
    .filter(([id]) => declaredIds.has(Number(id))),
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

export function thiefWeaponSkillMatchesSet(skill, pair, context = {}) {
  const specialization =
    context.specialization
    || context.config?.specialization
    || "Core";
  const professionState =
    context.professionState
    || context.state?.profession
    || null;
  if (skill.stealthAttack) {
    if (
      specialization === "Deadeye"
        ? !skill.malicious
        : skill.malicious
    ) return false;
  }
  if (
    skill.weapon === "Rifle"
    && professionState
    && !skill.stealthAttack
    && Boolean(skill.kneelSkill) !== Boolean(professionState.kneeling)
  ) return false;
  if (
    skill.requiredMainHand != null
    || skill.requiredOffHand != null
    || skill.requiresEmptyOffhand
  ) {
    const [mainHand = "", offHand = ""] = pair;
    return (
      (skill.requiredMainHand == null || skill.requiredMainHand === mainHand)
      && (
        skill.requiredOffHand == null
        || (
          skill.requiredOffHand === false
            ? !offHand
            : skill.requiredOffHand === offHand
        )
      )
    );
  }
  const wielding = context.weaponData?.[pair[0]]?.wielding
    || context.catalog?.weaponHands?.get(pair[0]);
  if (wielding === "2h") return skill.weapon === pair[0];
  const slot = Number(String(skill.slot || "").match(/(\d+)$/)?.[1] || 0);
  return slot <= 3 ? skill.weapon === pair[0] : skill.weapon === pair[1];
}
