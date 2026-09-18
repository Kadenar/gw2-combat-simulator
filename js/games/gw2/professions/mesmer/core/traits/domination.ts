import { EPSILON } from '#kernel/core/clock.js';
/** Owns imperative Core Mesmer Domination trait effects. */
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { balanceProfileEffectFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { MesmerCastContext, MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';

/** Adds two enemy packets to Mirror Blade's four-hit base inside the existing cast-emission interruption scope. */
export function scheduleBountifulBlades(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = context.mesmerRuntime;
  if (skill.id !== ID.MIRROR_BLADE || !runtime?.traits.has(TRAIT.BOUNTIFUL_BLADES)) return;
  // Trait bounces belong to the launched projectile and use the same commit boundary as its base packets.
  if (
    context.effectiveEnd < context.fullEnd - EPSILON &&
    (context.effectiveEnd - context.start) * 1000 + EPSILON * 1000 < Number(skill.interruptCommitMs)
  )
    return;
  const effect = balanceProfileEffectFromContext(context, TRAIT.BOUNTIFUL_BLADES, 'strike');
  if (effect?.type !== 'strike') return;
  runtime.addDamage(
    skill,
    context.start,
    {
      ticks: effect.ticks,
      persistsAfterInterrupt: true,
      name: 'Additional target hits from Bountiful Blades'
    },
    { sourceId: TRAIT.BOUNTIFUL_BLADES }
  );
}

/** A landed disable applies the player-owned trait condition, which equipment can then observe. */
export function triggerDazzling(
  context: MesmerSchedulerContext,
  event: SimulationEvent,
  skillId: number,
  skillName: string
): void {
  const runtime = context.mesmerRuntime;
  if (!runtime?.traits.has(TRAIT.DAZZLING) || missesTarget(event)) return;
  if (event.actorType !== 'player' && event.actorType !== 'summon') return;
  const effect = balanceProfileEffectFromContext(context, TRAIT.DAZZLING, 'condition');
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    skillId: Number.isFinite(skillId) ? skillId : undefined,
    skillName,
    source: 'Trait',
    sourceId: TRAIT.DAZZLING,
    actorType: 'effect',
    ownerActorType: 'player',
    condition: String(effect?.condition || 'Vulnerability'),
    stacks: Number(effect?.stacks ?? 5),
    duration: Number(effect?.duration ?? 8)
  });
}
