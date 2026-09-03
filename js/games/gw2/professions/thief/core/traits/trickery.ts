import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillControl } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { ThiefCastContext, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Applies Trickery's steal, initiative, and initiative-spend effects in dispatcher order. */
export function applyDeadlyAmbush(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.DEADLY_AMBUSH)) return;
  const bleeding = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.deadlyAmbush), 'condition');
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: String(bleeding?.condition || 'Bleeding'),
    duration: Number(bleeding?.duration || 10),
    stacks: Number(bleeding?.stacks || 3),
    sourceId: TRAIT.DEADLY_AMBUSH,
    name: 'Deadly Ambush — Bleeding'
  });
}

export function applyThrillOfTheCrime(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.THRILL_OF_THE_CRIME)) return;
  for (const effect of (balanceProfileFromContext(context, PROFILE.thrillOfTheCrime)?.effects || []).filter(
    (entry) => entry.type === 'boon'
  )) {
    const boon = String(effect.boon || effect.kind || '');
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: `thief.steal.${boon}`,
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      name: `Steal — ${boon}`,
      kind: boon,
      boon,
      duration: gw2SchedulerBoonDuration(context, context.skill, boon, Number(effect.duration || 10)),
      stacks: Number(effect.stacks || 1)
    });
  }
}

export function applyBountifulTheft(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.BOUNTIFUL_THEFT)) return;
  const profile = balanceProfileFromContext(context, PROFILE.bountifulTheft);
  const vigor = balanceProfileEffect(profile, 'boon', 0);
  const might = balanceProfileEffect(profile, 'boon', 1);
  const vigorName = String(vigor?.boon || 'Vigor');
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: `thief.steal.${vigorName}`,
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    name: `Steal — ${vigorName}`,
    kind: vigorName,
    boon: vigorName,
    duration: gw2SchedulerBoonDuration(context, context.skill, vigorName, Number(vigor?.duration || 10)),
    stacks: Number(vigor?.stacks || 1)
  });
  if (context.config.target?.boonless === false) return;
  const mightName = String(might?.boon || 'Might');
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: `thief.steal.${mightName}`,
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    name: `Steal — ${mightName}`,
    kind: mightName,
    boon: mightName,
    duration: gw2SchedulerBoonDuration(context, context.skill, mightName, Number(might?.duration || 10)),
    stacks: Number(might?.stacks || 5)
  });
}

export function applySleightOfHand(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.SLEIGHT_OF_HAND)) return;
  const control = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.sleightOfHand), 'control');
  emitSkillControl(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.SLEIGHT_OF_HAND,
    actorType: 'player',
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name: 'Sleight of Hand - Daze',
    effect: 'Daze',
    duration: Number(control?.duration || 1)
  });
}

export function applyKleptomaniac(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.KLEPTOMANIAC)) return;
  gainThiefInitiative(
    context,
    Number(balanceProfileFromContext(context, PROFILE.kleptomaniac)?.resourceGain || 2),
    at,
    'kleptomaniac'
  );
}

export function applyLeadAttacks(context: ThiefCastContext, skill: ThiefSkill, at: number): void {
  const initiativeCost = Math.max(0, Number(skill.initiativeCost || 0));
  if (initiativeCost <= 0 || !hasTrait(context.config, TRAIT.LEAD_ATTACKS)) return;
  const state = professionCoreState(context);
  const profile = balanceProfileFromContext(context, PROFILE.leadAttacks);
  const expirations = state.leadAttackExpirations || [];
  for (let stack = 0; stack < initiativeCost && expirations.length < Number(profile?.maximumStacks || 15); stack += 1) {
    expirations.push(at + Number(profile?.durationMultiplier || 10));
  }

  state.leadAttackExpirations = expirations;
  state.leadAttacksStacks = expirations.length;
  state.leadAttacksUntil = expirations.length ? Math.max(...expirations) : 0;

  emitThiefStateSnapshot(context, at, 'lead-attacks');
}
