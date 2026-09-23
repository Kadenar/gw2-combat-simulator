import {
  requireBalanceProfileFromContext,
  balanceProfileNumberFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import type { ThiefCastContext, ThiefEmissionContext, ThiefSkill } from '#gw2/professions/thief/types.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';

import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

// Starting malice when Deadeye's Mark is applied to a fresh target (Malicious Intent: 2, otherwise: 0)
export function initialDeadeyeMalice(context: ThiefCastContext): number {
  return hasTrait(context.config, TRAIT.MALICIOUS_INTENT)
    ? balanceProfileNumberFromContext(context, PROFILE.maliciousIntent, 'resourceGain')
    : 0;
}

/** Applies the malice-scaled condition owned by Malicious Ashen Assault. */
export function applyMaliciousAshenAssaultCondition(
  context: ThiefCastContext,
  skill: ThiefSkill,
  at: number,
  malice: number
): void {
  if (malice <= 0) return;

  const maliciousAshenAssaultProfile = requireBalanceProfileFromContext(context, PROFILE.maliciousAshenAssault);
  const torment = requireEffect(maliciousAshenAssaultProfile, 'condition', 'Torment', context);
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!torment) return;
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: String(torment.condition),
    duration:
      effectNumber(maliciousAshenAssaultProfile, torment, 'duration', context) +
      malice * balanceProfileNumber(maliciousAshenAssaultProfile, 'durationMultiplier', context),
    stacks: effectNumber(maliciousAshenAssaultProfile, torment, 'stacks', context),
    sourceId: skill.id,
    name: 'Malicious Ashen Assault — Torment'
  });
}

export function applyDeadeyesMarkTraits(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.BE_QUICK_OR_BE_KILLED)) return;
  const beQuickOrBeKilledProfile = requireBalanceProfileFromContext(context, PROFILE.beQuickOrBeKilled);
  const quickness = requireEffect(beQuickOrBeKilledProfile, 'boon', 'Quickness', context);
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!quickness) return;
  const boon = String(quickness.boon);
  const source = 'Be Quick or Be Killed';
  const sourceId = `thief.deadeye.${source.toLowerCase().replaceAll(' ', '-')}`;
  const sourceSkill = context.skill || ({ id: sourceId, name: source } as ThiefSkill);
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId,
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    name: `${source} — ${boon}`,
    kind: boon.toLowerCase(),
    boon,
    duration: gw2SchedulerBoonDuration(
      context,
      sourceSkill,
      boon,
      effectNumber(beQuickOrBeKilledProfile, quickness, 'duration', context)
    ),
    stacks: effectNumber(beQuickOrBeKilledProfile, quickness, 'stacks', context)
  });
}

// Apply Deadeye traits triggered by consuming a stolen skill at its committed
// timestamp, including resource and boon effects.
export function applyDeadeyeStolenSkillTraits(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.FIRE_FOR_EFFECT)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.fireForEffect);
  for (const effect of (profile?.effects || []).filter((entry) => entry.type === 'boon')) {
    const boon = String(effect.boon);
    const source = 'Fire for Effect';
    const sourceId = `thief.deadeye.${source.toLowerCase().replaceAll(' ', '-')}`;
    const sourceSkill = context.skill || ({ id: sourceId, name: source } as ThiefSkill);
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId,
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      name: `${source} — ${boon}`,
      kind: boon.toLowerCase(),
      boon,
      duration: gw2SchedulerBoonDuration(
        context,
        sourceSkill,
        boon,
        effectNumber(profile, effect, 'duration', context)
      ),
      stacks: effectNumber(profile, effect, 'stacks', context),
      audience: { recipients: 'party' as const, maximumRecipients: 5 }
    });
  }
}

export function applyMaleficentSeven(context: ThiefEmissionContext, at: number): void {
  const state = deadeyeState.from(context);
  if (
    state.malice !== state.maximumMalice ||
    // maleficentSevenTriggered prevents the proc from firing again if malice stays at maximum across multiple hits
    state.maleficentSevenTriggered ||
    !hasTrait(context.config, TRAIT.MALEFICENT_SEVEN)
  ) {
    return;
  }

  state.maleficentSevenTriggered = true;
  const profile = requireBalanceProfileFromContext(context, PROFILE.maleficentSeven);
  gainThiefInitiative(context, balanceProfileNumber(profile, 'resourceGain', context), at, 'maleficent-seven');
  for (const effect of (profile?.effects || []).filter((entry) => entry.type === 'boon')) {
    const boon = String(effect.boon);
    const source = 'Maleficent Seven';
    const sourceId = `thief.deadeye.${source.toLowerCase().replaceAll(' ', '-')}`;
    const sourceSkill = context.skill || ({ id: sourceId, name: source } as ThiefSkill);
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId,
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      name: `${source} — ${boon}`,
      kind: boon.toLowerCase(),
      boon,
      duration: gw2SchedulerBoonDuration(
        context,
        sourceSkill,
        boon,
        effectNumber(profile, effect, 'duration', context)
      ),
      stacks: effectNumber(profile, effect, 'stacks', context)
    });
  }
}
