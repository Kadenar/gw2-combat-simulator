/**
 * Owns Guardian spear's persistent Illuminated state and conditional packets.
 * Declarative spear fragments remain in `skills/weapons/spear.ts`.
 */
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { effectFirstAtMs, strikeEffectCoefficient, strikeEffectTicks } from '#gw2/platform/engine/effects/timelines.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import type { SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { GuardianCastContext, GuardianSchedulerContext, GuardianSkill } from '#gw2/professions/guardian/types.js';

type GuardianSpearEffect = SkillEffect & { readonly at?: number };

/**
 * Spear "Illuminated" mechanic (Janthir Wilds guardian spear).
 *
 * Model (see docs/professions/GUARDIAN.md "Spear Illuminated" for how this differs from the
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
const SPEAR_ILLUMINATION_ARMERS: ReadonlySet<SkillId> = new Set([ID.HELIO_RUSH, ID.GLEAMING_DISC, ID.SOLAR_STORM]);
const SPEAR_PROFILE_BY_SKILL_ID: Readonly<Record<string | number, SkillId>> = Object.freeze({
  [ID.HELIO_RUSH]: PROFILE.spearHelioRush,
  [ID.GLEAMING_DISC]: PROFILE.spearGleamingDisc,
  [ID.SOLAR_STORM]: PROFILE.spearSolarStorm
});

const ILLUMINATED_ICON = 'https://wiki.guildwars2.com/images/7/7d/Illuminated.png';
const SYMBOL_OF_LUMINANCE_ICON =
  'https://render.guildwars2.com/file/0E1E2D69CBC3C0E36217506C6CCB710138035373/3379129.png';

/**
 * Resolves a declarative effect's first strike time in simulation seconds.
 *
 * Absolute simulation timestamp for the first strike.
 */
function strikeStartSeconds(context: GuardianCastContext, effect: GuardianSpearEffect): number {
  const atMs = effect.type === 'strike' || effect.type === 'condition' ? effectFirstAtMs(effect) : effect.atMs;
  if (atMs != null) {
    const origin = effect.timingAnchor === 'castEnd' ? context.fullEnd : context.start;
    return origin + Number(atMs) / 1000;
  }

  if (effect.at != null) return context.start + Number(effect.at);

  return context.fullEnd;
}

/**
 * Applies the illuminated strike profile to a spear skill by replacing
 * existing packets or emitting the additional packets defined by the skill.
 *
 * Timestamp used for the Illuminated proc, or null when
 * no bonus packet could be applied.
 */
function emitIlluminatedBonus(context: GuardianCastContext, skill: GuardianSkill, multiplier: number): number | null {
  const interrupted = context.effectiveEnd < context.fullEnd - context.epsilon;
  const bonusFraction = multiplier - 1;
  let emittedAt: number | null = null;
  if (skill.id === ID.SOLAR_STORM) {
    const profile = balanceProfileFromContext(context, SPEAR_PROFILE_BY_SKILL_ID[skill.id]);
    const extraProjectiles = (profile?.effects || [])
      .filter((effect) => effect.type === 'strike')
      .map((effect, index) => ({ ...effect, hitIndex: index + 4 }));
    for (const projectile of extraProjectiles) {
      const at = context.start + Number(projectile.atMs || 0) / 1000;
      const hitIndex = projectile.hitIndex;
      if (interrupted && at > context.effectiveEnd + context.epsilon) continue;
      context.emit(
        buildGuardianStrike({
          sourceId: skill.id,
          skillId: skill.id,
          skillName: skill.name,
          at,
          name: `Solar Storm — ${projectile.hitIndex}th Strike`,
          coefficient: Number(projectile.coefficient || 0),
          hitIndex,
          totalHits: 5,
          skillWeapon: 'Spear'
        })
      );
      if (emittedAt == null) emittedAt = context.start + 0.56;
    }

    return emittedAt;
  }

  for (const effect of skill.effects || []) {
    if (effect.type !== 'strike' || !(strikeEffectCoefficient(effect) > 0)) continue;
    const ticks = strikeEffectTicks(effect);
    const hits = ticks.length;
    const totalBonus = strikeEffectCoefficient(effect) * bonusFraction;
    const firstAt = strikeStartSeconds(context, effect);
    if (skill.id === ID.HELIO_RUSH && hits === 1) {
      const baseHit = context.events.find(
        (event) =>
          event.type === 'damage' && event.skillId === skill.id && Math.abs(event.at - firstAt) <= context.epsilon
      );
      if (baseHit) {
        context.replaceEvent(baseHit, {
          coefficient: Number(baseHit.coefficient) + totalBonus
        });
        emittedAt = firstAt;
      }

      continue;
    }

    if (skill.id === ID.GLEAMING_DISC && hits === 2) {
      const shockWaveAt = firstAt + (Number(ticks[1].atMs) - Number(ticks[0].atMs)) / 1000;
      if (interrupted && shockWaveAt > context.effectiveEnd + context.epsilon) {
        continue;
      }

      const shockWave = context.events.find(
        (event) =>
          event.type === 'damage' &&
          event.skillId === skill.id &&
          event.hitIndex === 2 &&
          Math.abs(event.at - shockWaveAt) <= context.epsilon
      );
      if (shockWave) {
        context.replaceEvent(shockWave, {
          coefficient: Number(shockWave.coefficient) + totalBonus
        });
        emittedAt = firstAt;
      }

      continue;
    }

    for (const [index, tick] of ticks.entries()) {
      const hitIndex = index + 1;
      const at = firstAt + (Number(tick.atMs) - Number(ticks[0].atMs)) / 1000;
      if (interrupted && at > context.effectiveEnd + context.epsilon) break;
      context.emit(
        buildGuardianStrike({
          sourceId: skill.id,
          skillId: skill.id,
          skillName: skill.name,
          at,
          name: `${skill.name} (Illuminated)`,
          coefficient: Number(tick.coefficient) * bonusFraction,
          hitIndex,
          totalHits: hits,
          skillWeapon: 'Spear'
        })
      );
      if (emittedAt == null) emittedAt = at;
    }
  }

  return emittedAt;
}

/**
 * Emits a skill proc entry for the rotation timeline.
 */
function emitProc(
  context: GuardianCastContext,
  at: number,
  name: string,
  sourceSkill: string,
  icon: string,
  detail: string
): void {
  context.emit({
    type: 'proc',
    procType: 'skill',
    at,
    name,
    sourceSkill,
    source: 'Skill',
    sourceId: `guardian.${name.toLowerCase().replace(/\s+/g, '-')}`,
    icon,
    detail
  });
}

/**
 * Applies the Illuminated bonus after a spear cast, consumes any prior armed
 * charge, arms a new charge where applicable, and refreshes Symbol of
 * Luminance's persistent window.
 */
export function updateSpearIlluminationState(context: GuardianCastContext, skill: GuardianSkill): void {
  const state = professionCoreState(context);
  if (skill.weapon !== 'Spear') return;
  const luminanceActive = Number(state.spearLuminanceUntil || 0) > context.start + context.epsilon;
  const illuminatedArmed = Number(state.spearIlluminatedUntil || 0) > context.start + context.epsilon;
  state.spearIlluminatedArmed = illuminatedArmed;
  const illuminated = luminanceActive || illuminatedArmed;
  const multiplier = Number(
    balanceProfileFromContext(context, SPEAR_PROFILE_BY_SKILL_ID[skill.id])?.damageMultiplier || 1
  );

  if (illuminated && multiplier > 1) {
    const at = emitIlluminatedBonus(context, skill, multiplier);
    if (at != null) {
      emitProc(context, at, 'Illuminated', skill.name, ILLUMINATED_ICON, `${skill.name} illuminated (×${multiplier})`);
    }
  }

  // Only skills with an Illuminated variant consume the armed effect. Symbol
  // of Luminance supplies illumination independently and leaves it intact.
  if (illuminatedArmed && illuminated && multiplier > 1 && !luminanceActive) {
    state.spearIlluminatedArmed = false;
    state.spearIlluminatedUntil = 0;
  }

  if (skill.id === ID.SYMBOL_OF_LUMINANCE) {
    const duration = Number(
      balanceProfileEffect(balanceProfileFromContext(context, PROFILE.spearLuminance), 'buff')?.duration || 5
    );
    state.spearLuminanceUntil = context.effectiveEnd + duration;
    emitProc(
      context,
      context.effectiveEnd,
      'Symbol of Luminance',
      skill.name,
      SYMBOL_OF_LUMINANCE_ICON,
      'All spear skills illuminated while active'
    );
  } else if (SPEAR_ILLUMINATION_ARMERS.has(skill.id)) {
    const firstStrikeAt =
      (skill.effects || [])
        .filter((effect) => effect.type === 'strike' && strikeEffectCoefficient(effect) > 0)
        .map((effect) => strikeStartSeconds(context, effect))
        .sort((left, right) => left - right)[0] ?? context.effectiveEnd;
    state.spearIlluminatedArmed = true;
    state.spearIlluminatedUntil =
      firstStrikeAt +
      Number(balanceProfileEffect(balanceProfileFromContext(context, PROFILE.spearLuminance), 'buff')?.duration || 5);
  }
}

/**
 * Removes an armed Illuminated charge once scheduler time reaches its expiry.
 */
export function advanceSpearIlluminationState(context: GuardianSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  if (state.spearIlluminatedArmed && Number(state.spearIlluminatedUntil || 0) <= target + context.epsilon) {
    state.spearIlluminatedArmed = false;
    state.spearIlluminatedUntil = 0;
  }
}
