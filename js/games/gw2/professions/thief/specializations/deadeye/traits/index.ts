import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import type { ThiefCastContext, ThiefEmissionContext, ThiefSkill } from '#gw2/professions/thief/types.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';

import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

// Starting malice when Deadeye's Mark is applied to a fresh target (Malicious Intent: 2, otherwise: 0)
export function initialDeadeyeMalice(context: ThiefCastContext): number {
  return hasTrait(context.config, TRAIT.MALICIOUS_INTENT)
    ? Number(balanceProfileFromContext(context, PROFILE.maliciousIntent)?.resourceGain ?? 2)
    : 0;
}

// Additional malice added to the snapshot before a stealth attack resolves (same trait, same value — two separate game effects)
export function deadeyeStealthAttackMaliceBonus(context: ThiefCastContext): number {
  return initialDeadeyeMalice(context);
}

/** Applies the malice-scaled condition owned by Malicious Ashen Assault. */
export function applyMaliciousAshenAssaultCondition(
  context: ThiefCastContext,
  skill: ThiefSkill,
  at: number,
  malice: number
): void {
  if (malice <= 0) return;
  const profile = balanceProfileFromContext(context, PROFILE.maliciousAshenAssault);
  const torment = balanceProfileEffect(profile, 'condition');
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: String(torment?.condition || 'Torment'),
    duration: Number(torment?.duration ?? 0.5) + malice * Number(profile?.durationMultiplier ?? 0.5),
    stacks: Number(torment?.stacks ?? 1),
    sourceId: skill.id,
    name: 'Malicious Ashen Assault — Torment'
  });
}

export function applyDeadeyesMarkTraits(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.BE_QUICK_OR_BE_KILLED)) return;
  const quickness = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.beQuickOrBeKilled), 'boon');
  const boon = String(quickness?.boon || 'Quickness');
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
    duration: gw2SchedulerBoonDuration(context, sourceSkill, boon, Number(quickness?.duration ?? 4)),
    stacks: Number(quickness?.stacks ?? 1)
  });
}

// Apply Deadeye traits triggered by consuming a stolen skill at its committed
// timestamp, including resource and boon effects.
export function applyDeadeyeStolenSkillTraits(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.FIRE_FOR_EFFECT)) return;
  const profile = balanceProfileFromContext(context, PROFILE.fireForEffect);
  for (const effect of (profile?.effects || []).filter((entry) => entry.type === 'boon')) {
    const boon = String(effect.boon || effect.kind || '');
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
      duration: gw2SchedulerBoonDuration(context, sourceSkill, boon, Number(effect.duration ?? 12)),
      stacks: Number(effect.stacks ?? 1),
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
  const profile = balanceProfileFromContext(context, PROFILE.maleficentSeven);
  gainThiefInitiative(context, Number(profile?.resourceGain ?? 7), at, 'maleficent-seven');
  for (const effect of (profile?.effects || []).filter((entry) => entry.type === 'boon')) {
    const boon = String(effect.boon || effect.kind || '');
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
      duration: gw2SchedulerBoonDuration(context, sourceSkill, boon, Number(effect.duration || 0)),
      stacks: Number(effect.stacks ?? 1)
    });
  }
}
