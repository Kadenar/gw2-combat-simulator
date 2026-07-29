import { THIEF_SKILL_IDS as ID } from "../data/ids.js";

const PROFESSION_SKILL_BY_SPEC = Object.freeze({
  Core: ID.STEAL,
  Daredevil: ID.STEAL,
  Deadeye: ID.DEADEYES_MARK,
  Specter: ID.SIPHON,
  Antiquary: ID.SKRITT_SWIPE,
});
const ENTER_SHROUD = ID.ENTER_SHADOW_SHROUD;
const EXIT_SHROUD = ID.EXIT_SHADOW_SHROUD;

function deny(skill, code, cause, retryAt = null) {
  return {
    ready: false,
    retryAt,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  };
}
function activeWeapons(context) {
  return context.state.activeWeaponSet === 2
    ? [
        context.config.weaponSet2Primary || "",
        context.config.weaponSet2Secondary || "",
      ]
    : [
        context.config.primaryWeapon || "",
        context.config.secondaryWeapon || "",
      ];
}

export function thiefCastAvailability(context, skill) {
  const state = context.state.profession;
  const specialization = String(context.config.specialization || "Core");
  if (skill.id === -5) {
    return state.endurance >= 50
      ? { ready: true }
      : deny(skill, "thief.endurance", "requires 50 endurance.");
  }
  if (
    skill.dualWieldFollowup
    && Number(state.availableFlips[skill.id] || 0) <= context.start
  ) {
    return deny(
      skill,
      "thief.follow-up",
      "use its opening dual-wield skill first.",
    );
  }
  if (
    skill.dualWieldOpener
    && Number(state.availableFlips[skill.flipSkillId] || 0) > context.start
  ) {
    return deny(
      skill,
      "thief.follow-up-active",
      "use or wait out the active follow-up skill.",
    );
  }
  if (
    [ID.STEAL, ID.DEADEYES_MARK, ID.SIPHON, ID.SKRITT_SWIPE].includes(skill.id)
    && PROFESSION_SKILL_BY_SPEC[specialization] !== skill.id
  ) {
    return deny(
      skill,
      "thief.profession-replacement",
      "another profession mechanic replaces this action.",
    );
  }
  if (skill.artifactKind) {
    if (specialization !== "Antiquary") {
      return deny(skill, "thief.wrong-specialization", "requires Antiquary.");
    }
    if (
      state.artifactUsesRemaining <= 0
      || !state.artifactSlots.some(slot => slot.skillId === skill.id)
    ) {
      return deny(
        skill,
        "thief.artifact",
        "this artifact is not in an available artifact slot.",
      );
    }
  }
  if (skill.backfire) {
    return deny(
      skill,
      "thief.backfire-variant",
      "backfire variants are resolved by their Double Edge skill.",
    );
  }
  if (skill.id === ID.RESHUFFLE) {
    if (specialization !== "Antiquary") {
      return deny(skill, "thief.wrong-specialization", "requires Antiquary.");
    }
    if (
      state.artifactUsesRemaining <= 0
      || state.artifactSlots.length === 0
    ) {
      return deny(skill, "thief.artifact", "pilfer artifacts first.");
    }
  }
  if (skill.id === ENTER_SHROUD) {
    if (specialization !== "Specter") {
      return deny(skill, "thief.wrong-specialization", "requires Specter.");
    }
    if (state.shadowShroudActive) {
      return deny(skill, "thief.in-shroud", "Shadow Shroud is already active.");
    }
    if (state.shadowForce <= 0) {
      return deny(skill, "thief.shadow-force", "requires shadow force.");
    }
  }
  if (skill.id === EXIT_SHROUD && !state.shadowShroudActive) {
    return deny(skill, "thief.not-in-shroud", "Shadow Shroud is not active.");
  }
  if (skill.shadowShroudSkill && !state.shadowShroudActive) {
    return deny(skill, "thief.not-in-shroud", "enter Shadow Shroud first.");
  }
  if (
    state.shadowShroudActive
    && !skill.shadowShroudSkill
    && (
      skill.type === "Weapon"
      || ["Heal", "Utility", "Elite"].includes(skill.type)
    )
  ) {
    return deny(
      skill,
      "thief.in-shroud",
      "the Shadow Shroud bar replaces weapons and slot skills.",
    );
  }
  const [mainHand] = activeWeapons(context);
  const stealthed =
    state.stealthUntil > context.start
    && state.revealedUntil <= context.start;
  if (skill.stealthAttack) {
    if (!stealthed) {
      return deny(skill, "thief.not-stealthed", "requires stealth.");
    }
    if (skill.requiredMainHand && skill.requiredMainHand !== mainHand) {
      return deny(
        skill,
        "thief.stealth-weapon",
        `requires ${skill.requiredMainHand}.`,
      );
    }
    if (skill.malicious && specialization !== "Deadeye") {
      return deny(skill, "thief.malicious", "requires Deadeye.");
    }
    if (!skill.malicious && specialization === "Deadeye") {
      return deny(
        skill,
        "thief.malicious-replacement",
        "the malicious version replaces this stealth attack.",
      );
    }
  } else if (
    stealthed
    && skill.type === "Weapon"
    && skill.slot === "Weapon_1"
  ) {
    return deny(
      skill,
      "thief.stealth-replacement",
      "the active weapon's stealth attack replaces skill 1.",
    );
  }
  if (skill.id === ID.KNEEL && state.kneeling) {
    return deny(skill, "thief.kneeling", "already kneeling.");
  }
  if (skill.id === ID.FREE_ACTION && !state.kneeling) {
    return deny(skill, "thief.not-kneeling", "kneel first.");
  }
  if (
    skill.weapon === "Rifle"
    && skill.id !== ID.KNEEL
    && skill.id !== ID.FREE_ACTION
    && !skill.stealthAttack
    && Boolean(skill.kneelSkill) !== Boolean(state.kneeling)
  ) {
    return deny(
      skill,
      "thief.rifle-stance",
      state.kneeling ? "use a kneeling rifle skill." : "kneel first.",
    );
  }
  if (
    skill.slot === "Profession_2"
    && !skill.artifactKind
    && (skill.categories || []).includes("stolen skill")
    && state.storedStolenSkillId !== skill.id
  ) {
    return deny(
      skill,
      "thief.stolen-skill",
      "steal this skill before using it.",
    );
  }
  if (Number(skill.initiativeCost || 0) > state.initiative + context.epsilon) {
    const missing =
      Number(skill.initiativeCost || 0) - Number(state.initiative || 0);
    return deny(
      skill,
      "thief.initiative",
      `requires ${skill.initiativeCost} initiative.`,
      context.start + Math.max(0, missing),
    );
  }
  const chain = context.catalog.autoattackChainPositions.get(skill.id);
  if (
    chain
    && (state.autoattackChains[chain.root] || chain.root) !== skill.id
  ) {
    return deny(
      skill,
      "thief.autoattack-chain",
      "cast the earlier chain skill first.",
    );
  }
  return { ready: true };
}
