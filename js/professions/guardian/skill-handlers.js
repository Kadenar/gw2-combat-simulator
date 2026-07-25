import { GUARDIAN_SKILL_IDS } from "./ids.js";

function emitGuardianEvent(context, skill, type, event = {}) {
  context.emit({
    type,
    at: context.effectiveEnd,
    source: "guardian",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    ...event,
  });
}

function activateVirtue(context, skill) {
  const slot = Number(String(skill.slot || "").match(/(\d)$/)?.[1] || 0);
  const virtue = ["", "justice", "resolve", "courage"][slot];
  if (!virtue) return false;
  if (/^Tome of /.test(skill.name)) {
    context.state.profession.activeTome = virtue;
  }
  emitGuardianEvent(context, skill, "guardian.virtue-activated", {
    virtue,
    specialization:
      skill.specialization
      || context.config.specialization
      || "Core",
    passiveReadyAt:
      context.rechargeReadyAt ?? context.effectiveEnd,
  });
  return false;
}

function renewedFocus(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  for (const virtue of context.catalog.skills.filter(candidate =>
    candidate.categories?.includes("Virtue")
    && /^Profession_[1-3]$/.test(String(candidate.slot || "")))) {
    context.state.cooldowns.delete(virtue.id);
  }
  emitGuardianEvent(context, skill, "guardian.virtues-refreshed");
  return true;
}

function swapWeapons(context, skill) {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  context.state.profession.autoattackChains = {};
  emitGuardianEvent(context, skill, "weapon_set", { weaponSet });
  return true;
}

function stowTome(context, skill) {
  context.state.profession.activeTome = "";
  emitGuardianEvent(context, skill, "guardian.tome-stowed");
  return true;
}

function useTomePage(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  const state = context.state.profession;
  const pageCost = Math.max(1, Number(skill.pageCost || 1));
  if (state.tomePages >= state.maximumTomePages) {
    state.nextTomePageAt =
      context.effectiveEnd + state.tomePageInterval;
  }
  state.tomePages = Math.max(0, state.tomePages - pageCost);
  if (skill.id === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST) {
    state.ashesCharges = 2;
    state.ashesNextTriggerAt = context.effectiveEnd;
  }
  if (state.tomePages === 0) state.activeTome = "";
  emitGuardianEvent(context, skill, "guardian.tome-page-used", {
    tome: skill.tome,
    pageCost,
    pagesRemaining: state.tomePages,
  });
  return false;
}

function radiantForge(context, skill) {
  const entering = skill.name === "Enter Radiant Forge";
  context.state.profession.radiantForge = entering;
  context.state.profession.radiantForgeEndsAt =
    entering ? context.effectiveEnd + 20 : 0;
  context.state.profession.radiantWeapon = "";
  if (!entering) context.state.profession.availableFlips = {};
  emitGuardianEvent(
    context,
    skill,
    entering ? "guardian.radiant-forge-entered" : "guardian.radiant-forge-exited",
  );
  return true;
}

function radiantWeapon(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  if (skill.id === GUARDIAN_SKILL_IDS.GLARING_BURST) {
    const coefficient = {
      hammer: 1.25,
      blade: 1,
    }[context.state.profession.radiantWeapon] || 0;
    if (coefficient > 0) {
      context.emit({
        type: "damage",
        at: context.effectiveEnd,
        source: "guardian",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        name: skill.name,
        coefficient,
        hits: 1,
        hitIndex: 1,
        totalHits: 1,
        skillWeapon: "",
        canCrit: true,
      });
    }
    return true;
  }
  if (skill.radiantWeapon) {
    context.state.profession.radiantWeapon = skill.radiantWeapon;
  }
  return false;
}

export const guardianSkillHandlers = Object.freeze({
  "guardian.virtue": activateVirtue,
  "guardian.renewed-focus": renewedFocus,
  "guardian.weapon-swap": swapWeapons,
  "guardian.stow-tome": stowTome,
  "guardian.tome-page": useTomePage,
  "guardian.radiant-forge": radiantForge,
  "guardian.radiant-weapon": radiantWeapon,
});
