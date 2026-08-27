import { emitSkillBuff, emitSkillCondition } from '../../../../../platform/scheduler/skill-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { gainThiefInitiative } from '../../core/shared.js';
import { gw2SchedulerBoonDuration } from '../../../../../platform/scheduler/policy.js';
import type { ThiefCastContext, ThiefEmissionContext, ThiefSkill } from '../../types.js';
import { deadeyeState } from './state.js';
import { thiefBalanceProfile, thiefBalanceProfileEffect } from '../../core/profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

// Starting malice when Deadeye's Mark is applied to a fresh target (Malicious Intent: 2, otherwise: 0)
export function initialDeadeyeMalice(context: ThiefCastContext): number {
  return hasTrait(context.config, TRAIT.MALICIOUS_INTENT)
    ? Number(thiefBalanceProfile(context, PROFILE.maliciousIntent)?.resourceGain || 2)
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
  const profile = thiefBalanceProfile(context, PROFILE.maliciousAshenAssault);
  const torment = thiefBalanceProfileEffect(profile, 'condition');
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: String(torment?.condition || 'Torment'),
    duration: Number(torment?.duration || 0.5) + malice * Number(profile?.durationMultiplier || 0.5),
    stacks: Number(torment?.stacks || 1),
    sourceId: skill.id,
    name: 'Malicious Ashen Assault — Torment'
  });
}

export function applyDeadeyesMarkTraits(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.BE_QUICK_OR_BE_KILLED)) return;
  const quickness = thiefBalanceProfileEffect(thiefBalanceProfile(context, PROFILE.beQuickOrBeKilled), 'boon');
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
    duration: gw2SchedulerBoonDuration(context, sourceSkill, boon, Number(quickness?.duration || 4)),
    stacks: Number(quickness?.stacks || 1)
  });
}

// Apply Deadeye traits triggered by consuming a stolen skill at its committed
// timestamp, including resource and boon effects.
export function applyDeadeyeStolenSkillTraits(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.FIRE_FOR_EFFECT)) return;
  const profile = thiefBalanceProfile(context, PROFILE.fireForEffect);
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
      duration: gw2SchedulerBoonDuration(context, sourceSkill, boon, Number(effect.duration || 12)),
      stacks: Number(effect.stacks || 1),
      recipients: 'party',
      maximumRecipients: 5
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
  const profile = thiefBalanceProfile(context, PROFILE.maleficentSeven);
  gainThiefInitiative(context, Number(profile?.resourceGain || 7), at, 'maleficent-seven');
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
      stacks: Number(effect.stacks || 1)
    });
  }
}
