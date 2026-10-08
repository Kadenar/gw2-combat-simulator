import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { effectiveConduitAffinity } from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export const MESMER_RELEASE = 'revenant.release-mesmer-conditions';

/** Schedule affinity-sensitive Mesmer conditions independently of its ordinary strike and daze. */
export function scheduleMesmerReleaseConditions(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  for (const effect of cast.skill.effects ?? []) {
    if (effect.type !== 'condition') continue;
    for (const { event } of materializeSkillEffectApplications({
      skill: cast.skill,
      effect,
      start: cast.start,
      fullEnd: cast.fullEnd,
      reactionGroup: effect.reactions === undefined ? undefined : runtime.effectReactions.register(cast.skill, effect),
      baseEvent: {
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id
      }
    }))
      runtime.schedule(MESMER_RELEASE, event.at, {
        event,
        durationPerAffinity: effect.durationPerAffinity ?? 0,
        durationReductionPerAffinity: effect.durationReductionPerAffinity ?? 0
      });
  }
}

/** Mesmer release Torment scales with impact-time affinity; one simulated enemy applies self-Torment once. */
export function mesmerRelease(runtime: RevenantRuntime, data: unknown): void {
  const { event, durationPerAffinity, durationReductionPerAffinity } = data as {
    event: SimulationEventBase;
    durationPerAffinity: number;
    durationReductionPerAffinity: number;
  };
  const affinity = effectiveConduitAffinity(runtime);
  if (event.target === 'self') {
    const duration = Number(event.duration) * Math.max(0, 1 - affinity * durationReductionPerAffinity);
    runtime.profession.core.selfConditions.push({
      condition: String(event.condition),
      stacks: Number(event.stacks),
      at: event.at,
      expiresAt: event.at + duration,
      sourceId: event.sourceId,
      skillName: String(event.skillName)
    });
    return;
  }

  runtime.effects.emit({
    kind: 'packet',
    event: { ...event, duration: Number(event.duration) * (1 + affinity * durationPerAffinity) }
  });
}
