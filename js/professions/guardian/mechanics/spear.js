import { GUARDIAN_SKILL_IDS as ID } from "../data/ids.js";
import { GUARDIAN_HANDLER_MECHANICS } from "./skill-mechanics.js";

/**
 * Spear "Illuminated" mechanic (Janthir Wilds guardian spear).
 *
 * Model (see GUARDIAN.md "Spear Illuminated" for how this differs from the
 * reference build JSON, which used separate hand-picked "… Illuminated" skills):
 *
 * - Helio Rush (spear 2), Gleaming Disc (spear 3) and Solar Storm (spear 4)
 *   arm Illuminated: "your next spear attack is illuminated".
 * - Symbol of Luminance (spear 5) opens a time window during which every spear
 *   skill is illuminated and the armed buff is not consumed.
 * - An illuminated cast of a damage spear skill re-emits its strike ticks
 *   scaled by a per-skill multiplier (the extra damage the in-game illuminated
 *   variant deals). Only skills with a known enhanced form benefit and consume
 *   the buff, so filler autoattacks never waste it.
 */

// Per-skill illuminated damage multiplier, derived from the reference build's
// base → illuminated coefficients:
//   Helio Rush     1.8  → 2.7   (×1.50)
//   Gleaming Disc  1.5  → 1.875 (×1.25)
//   Solar Storm    3.6  → 4.5   (+4th/5th shard ≈ ×1.25)
const SPEAR_ILLUMINATED_MULT =
  GUARDIAN_HANDLER_MECHANICS.spear.illuminatedMultiplierBySkillId;
const SPEAR_ILLUMINATION_ARMERS = new Set(
  GUARDIAN_HANDLER_MECHANICS.spear.illuminationArmers,
);

const ILLUMINATED_ICON = "https://wiki.guildwars2.com/images/7/7d/Illuminated.png";
const SYMBOL_OF_LUMINANCE_ICON =
  "https://render.guildwars2.com/file/0E1E2D69CBC3C0E36217506C6CCB710138035373/3379129.png";

function strikeStartSeconds(context, effect) {
  if (effect.atMs != null) return context.start + Number(effect.atMs) / 1000;
  if (effect.at != null) return context.start + Number(effect.at);
  return context.fullEnd;
}

function emitIlluminatedBonus(context, skill, multiplier) {
  const interrupted = context.effectiveEnd < context.fullEnd - context.epsilon;
  const bonusFraction = multiplier - 1;
  let emittedAt = null;
  for (const effect of skill.effects || []) {
    if (effect.type !== "strike" || !(Number(effect.coefficient) > 0)) continue;
    const hits = Math.max(1, Math.trunc(Number(effect.hits || 1)));
    const perHit = (Number(effect.coefficient) / hits) * bonusFraction;
    const interval = Math.max(0, Number(effect.intervalMs || 0)) / 1000;
    const firstAt = strikeStartSeconds(context, effect);
    for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
      const at = firstAt + (hitIndex - 1) * interval;
      if (interrupted && at > context.effectiveEnd + context.epsilon) break;
      context.emit({
        source: context.profession.id,
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        type: "damage",
        at,
        name: `${skill.name} (Illuminated)`,
        coefficient: perHit,
        hits: 1,
        hitIndex,
        totalHits: hits,
        skillWeapon: "Spear",
        canCrit: true,
      });
      if (emittedAt == null) emittedAt = at;
    }
  }
  return emittedAt;
}

function emitProc(context, at, name, sourceSkill, icon, detail) {
  context.emit({
    type: "proc",
    procType: "skill",
    at,
    name,
    sourceSkill,
    source: "Skill",
    sourceId: `guardian.${name.toLowerCase().replace(/\s+/g, "-")}`,
    icon,
    detail,
  });
}

/**
 * afterCast hook: applies the Illuminated bonus for the current spear cast, then
 * consumes/arms the buff and refreshes the Symbol of Luminance window.
 */
export function updateSpearIlluminationState(context, skill) {
  if (skill.weapon !== "Spear") return;

  const state = context.state.profession;
  const luminanceActive =
    Number(state.spearLuminanceUntil || 0) > context.start + context.epsilon;
  const illuminated = luminanceActive || state.spearIlluminatedArmed === true;
  const multiplier = SPEAR_ILLUMINATED_MULT[skill.id] || 1;

  if (illuminated && multiplier > 1) {
    const at = emitIlluminatedBonus(context, skill, multiplier);
    if (at != null) {
      emitProc(
        context,
        at,
        "Illuminated",
        skill.name,
        ILLUMINATED_ICON,
        `${skill.name} illuminated (×${multiplier})`,
      );
    }
    // Only the enhanced-damage spear skills consume the armed buff, so filler
    // autoattacks never waste it. Symbol of Luminance keeps it up for free.
    if (!luminanceActive) state.spearIlluminatedArmed = false;
  }

  if (skill.id === ID.SYMBOL_OF_LUMINANCE) {
    state.spearLuminanceUntil =
      context.effectiveEnd
      + GUARDIAN_HANDLER_MECHANICS.spear.symbolLuminanceDurationMs / 1000;
    emitProc(
      context,
      context.effectiveEnd,
      "Symbol of Luminance",
      skill.name,
      SYMBOL_OF_LUMINANCE_ICON,
      "All spear skills illuminated while active",
    );
  } else if (SPEAR_ILLUMINATION_ARMERS.has(skill.id)) {
    state.spearIlluminatedArmed = true;
  }
}
