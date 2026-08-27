import { emitSkillCondition } from '../../../../../platform/scheduler/skill-events.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { buildGuardianStrike } from '../../core/events.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { guardianBalanceProfile, guardianBalanceProfileEffect } from '../../core/profiles.js';
import type { GuardianCastContext, GuardianSkill } from '../../types.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

export function applySoaringDevastation(context: GuardianCastContext, skill: GuardianSkill, skillWeapon: string): void {
  if (!hasTrait(context, TRAIT.SOARING_DEVASTATION)) return;
  const at = context.effectiveEnd;
  const profile = guardianBalanceProfile(context, PROFILE.soaringDevastation);
  const strike = guardianBalanceProfileEffect(profile, 'strike');
  const immobilized = guardianBalanceProfileEffect(profile, 'condition');
  // skillWeapon must come from the caller (resolved to the active weapon set)
  // because traits.ts has no direct access to config at emit time.
  context.emit(
    buildGuardianStrike({
      at,
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
      name: 'Wings of Resolve — Soaring Devastation',
      coefficient: Number(strike?.coefficient || 1.5),
      skillWeapon
    })
  );
  emitSkillCondition(context, {
    at,
    source: 'guardian',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Soaring Devastation — Immobilized',
    condition: String(immobilized?.condition || 'Immobilized'),
    stacks: Number(immobilized?.stacks || 1),
    duration: Number(immobilized?.duration || 3)
  });
}

export function bigGameHunterTetherDuration(context: GuardianCastContext): number {
  // Big Game Hunter doubles tether duration (6 → 12s) and is also what
  // unlocks the Vulnerability condition and passive Crippled in the resolver.
  return hasTrait(context, TRAIT.BIG_GAME_HUNTER)
    ? Number(guardianBalanceProfile(context, PROFILE.bigGameHunter)?.pulseInterval || 12)
    : 6;
}
