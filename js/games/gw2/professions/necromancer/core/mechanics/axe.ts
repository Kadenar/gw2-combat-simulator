import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { DamageEvent } from '#gw2/platform/engine/events/events.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { predictNecromancerLifeForceGain } from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent
} from '#gw2/professions/necromancer/types.js';

/** Grants Ghastly Claws life force for each scheduled packet in the same pass, before later casts spend it. */
export function predictGhastlyClawsLifeForce(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent
): void {
  if (event.type !== 'damage' || event.actorType !== 'player' || event.offTarget === true) return;
  if (Number(event.skillId) !== ID.GHASTLY_CLAWS) return;
  predictNecromancerLifeForceGain(
    context,
    event.at,
    Number(context.catalog.skillsById.get(ID.GHASTLY_CLAWS)?.lifeForcePerHit || 0)
  );
}

/** Resolve axe bonuses on actual hits so interruption, live health, and resource feedback share the same packets. */
export function reactToNecromancerAxeDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (event.actorType !== 'player') return;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  if (!skill) return;

  if (skill.id === ID.GHASTLY_CLAWS) {
    // Refinement verifies the scheduler's per-packet prediction against these landed packets, including interruptions.
    context.resolved.push({
      type: 'necromancer.life-force-gain',
      at: event.at,
      source: 'necromancer',
      sourceId: skill.id,
      actorType: 'player',
      amount: Number(skill.lifeForcePerHit || 0)
    });
    return;
  }

  if (skill.id !== ID.RENDING_CLAWS && skill.id !== ID.UNHOLY_FEAST) return;
  if (targetHealthFraction({ config: context.config, runtime: context, time: event.at }) >= 0.5) return;

  if (skill.id === ID.RENDING_CLAWS) {
    const vulnerability = skill.effects?.find((effect) => effect.type === 'condition')?.ticks?.[
      Number(event.hitIndex || 1) - 1
    ];
    if (!vulnerability || !('condition' in vulnerability)) return;
    // Duplicate only this hit's authored Vulnerability application below half health.
    context.queue.enqueue(
      buildResolverCondition({
        at: event.at,
        source: 'necromancer',
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        actorType: 'player',
        condition: vulnerability.condition,
        stacks: vulnerability.stacks,
        duration: vulnerability.duration
      })
    );
    return;
  }

  const burst = context.helpers.skillsById?.get(ID.UNHOLY_BURST);
  if (!burst) return;
  for (const effect of burst.effects || []) {
    if (effect.type !== 'strike') continue;
    for (const { event: packet } of materializeSkillEffectApplications({
      skill: burst,
      effect,
      start: event.at,
      fullEnd: event.at,
      baseEvent: {
        source: 'necromancer',
        sourceId: burst.id,
        skillId: burst.id,
        skillName: burst.name,
        actorType: 'player',
        triggeredBy: skill.name,
        activationId: event.activationId
      }
    })) {
      context.queue.enqueue(packet as DamageEvent);
    }
  }
}
