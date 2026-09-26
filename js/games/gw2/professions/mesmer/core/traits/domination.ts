import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { EPSILON } from '#kernel/core/clock.js';
/** Owns imperative Core Mesmer Domination trait effects. */
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

/** Adds two enemy packets to Mirror Blade's four-hit base inside the existing cast-emission interruption scope. */
export function scheduleBountifulBlades(context: MesmerRuntime, cast: RuntimeCast, skill: MesmerSkill): void {
  const runtime = mesmerMechanicsFor(context);
  if (skill.id !== ID.MIRROR_BLADE || !runtime.traits.has(TRAIT.BOUNTIFUL_BLADES)) return;
  // Trait bounces belong to the launched projectile and use the same commit boundary as its base packets.
  if (
    castWasInterrupted(cast) &&
    (cast.effectiveEnd - cast.start) * 1000 + EPSILON * 1000 < Number(skill.interruptCommitMs)
  )
    return;
  const bountifulBladesProfile = requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_BLADES);
  const effect = requireEffect(bountifulBladesProfile, 'strike', 'Strike');
  if (!effect) return;
  if (effect?.type !== 'strike') return;
  runtime.addDamage(
    skill,
    cast.start,
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
  context: MesmerRuntime,
  event: SimulationEvent,
  skillId: number,
  skillName: string
): void {
  const runtime = mesmerMechanicsFor(context);
  if (!runtime.traits.has(TRAIT.DAZZLING) || missesTarget(event)) return;
  if (event.actorType !== 'player' && event.actorType !== 'summon') return;
  const dazzlingProfile = requireBalanceProfileFromContext(context, TRAIT.DAZZLING);
  const effect = requireEffect(dazzlingProfile, 'condition', 'Vulnerability');
  if (!effect) return;
  context.emitDerived(
    event,
    buildResolverCondition({
      at: event.at,
      skillId: Number.isFinite(skillId) ? skillId : undefined,
      skillName,
      source: 'Trait',
      sourceId: TRAIT.DAZZLING,
      actorType: 'effect',
      ownerActorType: 'player',
      condition: String(effect.condition),
      stacks: Number(effect.stacks),
      duration: Number(effect.duration)
    })
  );
}
