import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../../platform/engine/skill-handlers.js";
import { WEAPON_STRENGTH } from "../skill-mechanics.js";

function conditionName(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "poison" || normalized === "poisoned") return "Poisoned";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function legacyWeaponStrength(effect, skill) {
  if (effect.weaponStrength != null) return Number(effect.weaponStrength);
  const explicit = String(effect.weapon || "");
  const normalized =
    explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
  return WEAPON_STRENGTH[normalized] ?? WEAPON_STRENGTH[skill.weapon];
}

function observeDeclarativeEffect(context, skill, event, _state, { effect }) {
  if (!event) return;
  if (event.type === "damage") {
    const individuallyTimed =
      Array.isArray(effect.ticks) ||
      Number(effect.intervalMs || 0) > 0 ||
      Number(skill.pulseCount || 0) > 1;
    context.replaceEvent(event, {
      source: effect.actorType === "phantasm" ? "Phantasm" : "Player",
      blade: Boolean(skill.blade),
      canCrit: undefined,
      name: skill.name,
      totalHits: individuallyTimed ? 1 : event.totalHits,
      weapon: effect.weapon || "",
      weaponStrength: legacyWeaponStrength(effect, skill),
      skillWeapon:
        skill.weapon ||
        (["Heal", "Utility", "Elite"].includes(skill.type)
          ? "Utility"
          : context.mesmerRuntime.activePrimaryWeapon()),
    });
    return;
  }
  if (event.type === "condition") {
    const condition = conditionName(event.condition);
    context.replaceEvent(event, {
      source: "Player",
      sourceId: skill.name,
      skillId: null,
      condition,
      name: `${skill.name} — ${condition}`,
      applicationIndex: undefined,
      totalApplications: undefined,
    });
  }
}

const replaceProfile = replaceSkillHandler(() => null);

export const mesmerSkillHandlers = Object.freeze({
  "mesmer.declarative": augmentSkillHandler(null, {
    afterEffect: observeDeclarativeEffect,
  }),
  "mesmer.weapon-swap": replaceProfile,
  "mesmer.mirage-dodge": replaceProfile,
  "mesmer.continuum-shift": replaceProfile,
  "mesmer.continuum-split": replaceProfile,
  "mesmer.shatter": replaceProfile,
  "mesmer.bladesong": replaceProfile,
  "mesmer.instrument": replaceProfile,
  "mesmer.crescendo": replaceProfile,
  "mesmer.phantasm": replaceProfile,
  "mesmer.ambush": replaceProfile,
  "mesmer.resource-skill": replaceProfile,
  "mesmer.flip": replaceProfile,
  "mesmer.tracked-hits": replaceProfile,
  "mesmer.special-profile": replaceProfile,
});
