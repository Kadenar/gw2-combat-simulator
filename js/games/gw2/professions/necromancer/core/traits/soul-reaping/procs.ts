import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

/** Share Dhuumfire projection with tooltips and apply shroud attack procs without importing shroud mechanics. */

/** Mechanic metadata overrides skill duration, then trait tuning; Core needs no specialization knowledge. */
export function dhuumfireProjection(
  context: unknown,
  source: { readonly dhuumfireDuration?: unknown; readonly dhuumfireInterval?: number } = {},
  skillDuration?: unknown
) {
  const profile = requireBalanceProfileFromContext(context, TRAIT.DHUUMFIRE);
  const burning = requireEffect(profile, 'condition', 'Burning');
  const duration = source.dhuumfireDuration ?? skillDuration;
  return {
    interval: source.dhuumfireInterval ?? 0,
    effect: burning
      ? {
          type: 'condition' as const,
          name: burning.name,
          condition: String(burning.condition),
          stacks: effectNumber(profile, burning, 'stacks'),
          duration: duration == null ? effectNumber(profile, burning, 'duration') : Number(duration)
        }
      : undefined
  };
}

export function applyDhuumfire(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  skillDuration: unknown,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.DHUUMFIRE) || !shroudSkillOne) return;
  const { effect, interval } = dhuumfireProjection(context, event.metadata, skillDuration);
  // Zero or absent intervals bypass the claim so same-time applications remain unrestricted; the claim gates only
  // Burning, so a removed packet leaves it ready.
  if (!effect) return;
  if (interval > 0 && !context.procs.claimCooldown('dhuumfire', event.at, interval)) {
    return;
  }

  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.DHUUMFIRE,
        actorType: 'effect',
        skillName: 'Dhuumfire',
        triggeredBy: event.skillName,
        type: 'condition',
        ownerActorType: 'player',
        name: 'Dhuumfire' + ' - ' + effect.condition,
        condition: effect.condition,
        stacks: effect.stacks,
        duration: effect.duration
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Dhuumfire', at: event.at, sourceSkill: event.skillName }
    });
  }
}

export function applyUnyieldingBlast(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.UNYIELDING_BLAST) || !firstHit || !shroudSkillOne) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.UNYIELDING_BLAST);
  const effect = requireEffect(profile, 'condition', 'Vulnerability');
  if (!effect) return;
  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
      kind: 'packet',
      event: {
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.UNYIELDING_BLAST,
        actorType: 'effect',
        skillName: 'Unyielding Blast',
        triggeredBy: event.skillName,
        type: 'condition',
        name: 'Unyielding Blast',
        condition: 'Vulnerability',
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration')
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Unyielding Blast', at: event.at, sourceSkill: event.skillName }
    });
  }
}
