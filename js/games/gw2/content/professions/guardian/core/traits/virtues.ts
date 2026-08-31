import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { buildGuardianStrike } from '#gw2/content/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/guardian/core/profiles.js';
import type {
  GuardianCastContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/content/professions/guardian/types.js';

/** Applies Virtues trait effects at their existing positions in the public Guardian dispatchers. */
export function applyInspiredVirtue(
  context: GuardianCastContext,
  skill: GuardianSkill,
  virtueSlot: string,
  at: number
): void {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE)) return;
  const inspired = balanceProfileEffect(
    balanceProfileFromContext(context, PROFILE.inspiredVirtue),
    'boon',
    virtueSlot === 'Profession_1' ? 0 : virtueSlot === 'Profession_2' ? 1 : 2
  );
  const boon = String(inspired?.boon || 'protection');
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    stacks: Number(inspired?.stacks || 1),
    sourceId: GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
    actorType: 'player',
    name: 'Inspired Virtue',
    kind: boon,
    duration: Number(inspired?.duration || 5)
  });
}

export function applyVirtueOfResolution(context: GuardianCastContext, skill: GuardianSkill, at: number): void {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)) return;
  const resolution = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.virtueOfResolution), 'boon');
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
    actorType: 'player',
    name: 'Virtue of Resolution',
    kind: 'resolution',
    duration: Number(resolution?.duration || 3),
    stacks: 1
  });
}

export function applyInspiringVirtue(context: GuardianCastContext, skill: GuardianSkill, at: number): void {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE)) return;
  const inspiring = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.inspiringVirtue), 'buff');
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE,
    actorType: 'player',
    name: 'Inspiring Virtue',
    kind: 'guardian-inspiring-virtue',
    duration: Number(inspiring?.duration || 6),
    stacks: 1
  });
}

export function applyIndomitableCourage(
  context: GuardianCastContext,
  skill: GuardianSkill,
  virtueSlot: string,
  at: number
): void {
  if (virtueSlot !== 'Profession_3' || !hasTrait(context, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)) return;
  const stability = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.indomitableCourage), 'boon');
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    stacks: Number(stability?.stacks || 3),
    sourceId: GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE,
    actorType: 'player',
    name: 'Indomitable Courage',
    kind: 'stability',
    duration: Number(stability?.duration || 4)
  });
}

// Report whether the dispatcher must stop so Resolution replacement keeps its original early-return boundary.
export function replaceVirtueOfResolutionDuration(
  context: GuardianSchedulerContext,
  event: GuardianResolverEvent
): boolean {
  if (
    event.type !== 'buff' ||
    String(event.kind || '').toLowerCase() !== 'resolution' ||
    !(Number(event.duration || 0) > 0) ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)
  ) {
    return false;
  }

  context.replaceEvent(event, {
    duration:
      Number(event.duration) *
      Number(balanceProfileFromContext(context, PROFILE.virtueOfResolution)?.durationMultiplier || 1.25)
  });
  return true;
}

export function applyMasterOfConsecrations(context: GuardianCastContext, skill: GuardianSkill): void {
  if (
    skill.id !== GUARDIAN_SKILL_IDS.PURGING_FLAMES ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS)
  ) {
    return;
  }

  const profile = balanceProfileFromContext(context, PROFILE.masterOfConsecrations);
  const strike = balanceProfileEffect(profile, 'strike');
  const burning = balanceProfileEffect(profile, 'condition');
  const ticks = strike?.type === 'strike' ? strike.ticks : null;
  if (!ticks?.length) throw new Error('Master of Consecrations requires an explicit strike timeline.');
  for (const [index, tick] of ticks.entries()) {
    const pulseAt = context.start + 6.32 + Number(tick.atMs) / 1000;
    context.emit(
      buildGuardianStrike({
        at: pulseAt,
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        name: skill.name,
        coefficient: Number(tick.coefficient),
        skillWeapon: 'Unequipped',
        hitIndex: 7 + index,
        totalHits: 6 + ticks.length
      })
    );
    emitSkillCondition(context, {
      at: pulseAt,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: `${skill.name} — Burning`,
      condition: String(burning?.condition || 'Burning'),
      stacks: Number(burning?.stacks || 1),
      duration: Number(burning?.duration || 2)
    });
  }
}
