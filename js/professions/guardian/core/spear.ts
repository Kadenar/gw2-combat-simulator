/**
 * @fileoverview Implements Guardian spear's Illuminated state machine and
 * applies its conditional damage changes to scheduler events.
 */

import { GUARDIAN_SKILL_IDS as ID } from "../data/ids.js";
import { GUARDIAN_CORE_MECHANICS } from "./mechanics.js";
import { buildGuardianStrike } from "./events.js";
import type { SkillEffect, SkillId } from "../../../platform/engine/types.js";
import type {
  GuardianCastContext,
  GuardianSchedulerContext,
  GuardianSkill,
} from "../types.js";

type GuardianSpearEffect = SkillEffect & { readonly at?: number };

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
 * - An illuminated Helio Rush modifies its existing hit, Gleaming Disc
 *   modifies its existing shock wave, and Solar Storm adds its fourth and
 *   fifth projectiles. Only skills with a known enhanced form benefit and
 *   consume the buff, so filler autoattacks never waste it.
 */

// Per-skill illuminated damage multiplier, derived from the reference build's
// base → illuminated aggregate coefficients:
//   Helio Rush     1.5 → 2.25 (×1.50)
//   Gleaming Disc  3.0 → 3.75 (×1.25 aggregate; shock-wave bonus)
//   Solar Storm    3.6 → 4.5   (+4th/5th shard ≈ ×1.25)
const SPEAR_ILLUMINATED_MULT: Readonly<Record<string | number, number>> =
  GUARDIAN_CORE_MECHANICS.spear.illuminatedMultiplierBySkillId;
const SPEAR_ILLUMINATION_ARMERS: ReadonlySet<SkillId> = new Set(
  GUARDIAN_CORE_MECHANICS.spear.illuminationArmers,
);

const ILLUMINATED_ICON =
  "https://wiki.guildwars2.com/images/7/7d/Illuminated.png";
const SYMBOL_OF_LUMINANCE_ICON =
  "https://render.guildwars2.com/file/0E1E2D69CBC3C0E36217506C6CCB710138035373/3379129.png";

/**
 * Resolves a declarative effect's first strike time in simulation seconds.
 *
 * @param {GuardianCastContext} context Active cast context.
 * @param {GuardianSpearEffect} effect Declarative skill effect.
 * @returns {number} Absolute simulation timestamp for the first strike.
 */
function strikeStartSeconds(
  context: GuardianCastContext,
  effect: GuardianSpearEffect,
): number {
  if (effect.atMs != null) return context.start + Number(effect.atMs) / 1000;
  if (effect.at != null) return context.start + Number(effect.at);
  return context.fullEnd;
}

/**
 * Applies the illuminated strike profile to a spear skill by replacing
 * existing packets or emitting the additional packets defined by the skill.
 *
 * @param {GuardianCastContext} context Active cast context.
 * @param {GuardianSkill} skill Cast spear skill.
 * @param {number} multiplier Illuminated aggregate damage multiplier.
 * @returns {number|null} Timestamp used for the Illuminated proc, or null when
 * no bonus packet could be applied.
 */
function emitIlluminatedBonus(
  context: GuardianCastContext,
  skill: GuardianSkill,
  multiplier: number,
): number | null {
  const interrupted = context.effectiveEnd < context.fullEnd - context.epsilon;
  const bonusFraction = multiplier - 1;
  let emittedAt: number | null = null;
  if (skill.id === ID.SOLAR_STORM) {
    const extraProjectiles = [
      { at: context.start + 1.16, coefficient: 0.6, hitIndex: 4 },
      { at: context.start + 1.36, coefficient: 0.3, hitIndex: 5 },
    ];
    for (const projectile of extraProjectiles) {
      if (interrupted && projectile.at > context.effectiveEnd + context.epsilon)
        continue;
      context.emit(
        buildGuardianStrike({
          sourceId: skill.id,
          skillId: skill.id,
          skillName: skill.name,
          at: projectile.at,
          name: `Solar Storm — ${projectile.hitIndex}th Strike`,
          coefficient: projectile.coefficient,
          hitIndex: projectile.hitIndex,
          totalHits: 5,
          skillWeapon: "Spear",
        }),
      );
      if (emittedAt == null) emittedAt = context.start + 0.56;
    }
    return emittedAt;
  }
  for (const effect of skill.effects || []) {
    if (effect.type !== "strike" || !(Number(effect.coefficient) > 0)) continue;
    const hits = Math.max(1, Math.trunc(Number(effect.hits || 1)));
    const totalBonus = Number(effect.coefficient) * bonusFraction;
    const perHit = totalBonus / hits;
    const interval = Math.max(0, Number(effect.intervalMs || 0)) / 1000;
    const firstAt = strikeStartSeconds(context, effect);
    if (skill.id === ID.HELIO_RUSH && hits === 1) {
      const baseHit = context.events.find(
        (event) =>
          event.type === "damage" &&
          event.skillId === skill.id &&
          Math.abs(event.at - firstAt) <= context.epsilon,
      );
      if (baseHit) {
        context.replaceEvent(baseHit, {
          coefficient: Number(baseHit.coefficient) + totalBonus,
        });
        emittedAt = firstAt;
      }
      continue;
    }
    if (skill.id === ID.GLEAMING_DISC && hits === 2) {
      const shockWaveAt = firstAt + interval;
      if (interrupted && shockWaveAt > context.effectiveEnd + context.epsilon) {
        continue;
      }
      const shockWave = context.events.find(
        (event) =>
          event.type === "damage" &&
          event.skillId === skill.id &&
          event.hitIndex === 2 &&
          Math.abs(event.at - shockWaveAt) <= context.epsilon,
      );
      if (shockWave) {
        context.replaceEvent(shockWave, {
          coefficient: Number(shockWave.coefficient) + totalBonus,
        });
        emittedAt = firstAt;
      }
      continue;
    }
    for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
      const at = firstAt + (hitIndex - 1) * interval;
      if (interrupted && at > context.effectiveEnd + context.epsilon) break;
      context.emit(
        buildGuardianStrike({
          sourceId: skill.id,
          skillId: skill.id,
          skillName: skill.name,
          at,
          name: `${skill.name} (Illuminated)`,
          coefficient: perHit,
          hitIndex,
          totalHits: hits,
          skillWeapon: "Spear",
        }),
      );
      if (emittedAt == null) emittedAt = at;
    }
  }
  return emittedAt;
}

/**
 * Emits a skill proc entry for the rotation timeline.
 *
 * @param {GuardianCastContext} context Active cast context.
 * @param {number} at Proc timestamp.
 * @param {string} name Proc name.
 * @param {string} sourceSkill Skill that caused the proc.
 * @param {string} icon Icon URL.
 * @param {string} detail Human-readable proc detail.
 * @returns {void}
 */
function emitProc(
  context: GuardianCastContext,
  at: number,
  name: string,
  sourceSkill: string,
  icon: string,
  detail: string,
): void {
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
 * Applies the Illuminated bonus after a spear cast, consumes any prior armed
 * charge, arms a new charge where applicable, and refreshes Symbol of
 * Luminance's persistent window.
 *
 * @param {GuardianCastContext} context Scheduler after-cast context.
 * @param {GuardianSkill} skill Completed skill.
 * @returns {void}
 */
export function updateSpearIlluminationState(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  const state = context.state.profession;
  if (skill.id === ID.DAYBREAKING_SLASH) {
    state.daybreakingSlashChainStep =
      Number(state.daybreakingSlashChainStep || 0) === 0 ? 1 : 0;
  } else {
    state.daybreakingSlashChainStep = 0;
  }
  if (skill.weapon !== "Spear") return;
  const luminanceActive =
    Number(state.spearLuminanceUntil || 0) > context.start + context.epsilon;
  const illuminatedArmed =
    Number(state.spearIlluminatedUntil || 0) > context.start + context.epsilon;
  state.spearIlluminatedArmed = illuminatedArmed;
  const illuminated = luminanceActive || illuminatedArmed;
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
  }
  // Any spear attack consumes the armed effect. Symbol of Luminance supplies
  // illumination independently and therefore leaves the armed effect intact.
  if (illuminatedArmed && !luminanceActive) {
    state.spearIlluminatedArmed = false;
    state.spearIlluminatedUntil = 0;
  }

  if (skill.id === ID.SYMBOL_OF_LUMINANCE) {
    state.spearLuminanceUntil =
      context.effectiveEnd +
      GUARDIAN_CORE_MECHANICS.spear.symbolLuminanceDurationMs / 1000;
    emitProc(
      context,
      context.effectiveEnd,
      "Symbol of Luminance",
      skill.name,
      SYMBOL_OF_LUMINANCE_ICON,
      "All spear skills illuminated while active",
    );
  } else if (SPEAR_ILLUMINATION_ARMERS.has(skill.id)) {
    const firstStrikeAt =
      (skill.effects || [])
        .filter(
          (effect) =>
            effect.type === "strike" && Number(effect.coefficient) > 0,
        )
        .map((effect) => strikeStartSeconds(context, effect))
        .sort((left, right) => left - right)[0] ?? context.effectiveEnd;
    state.spearIlluminatedArmed = true;
    state.spearIlluminatedUntil = firstStrikeAt + 5;
  }
}

/**
 * Removes an armed Illuminated charge once scheduler time reaches its expiry.
 *
 * @param {GuardianSchedulerContext} context Scheduler advancement context.
 * @param {number} target Target simulation time.
 * @returns {void}
 */
export function advanceSpearIlluminationState(
  context: GuardianSchedulerContext,
  target: number,
): void {
  const state = context.state.profession;
  if (
    state.spearIlluminatedArmed &&
    Number(state.spearIlluminatedUntil || 0) <= target + context.epsilon
  ) {
    state.spearIlluminatedArmed = false;
    state.spearIlluminatedUntil = 0;
  }
}
