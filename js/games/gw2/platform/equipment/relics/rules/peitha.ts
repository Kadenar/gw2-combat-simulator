/** Peitha relic rules. */
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { skillForEvent } from '#gw2/platform/combat/query/event-skill.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { defineRelic, timedStrikeBuff } from '#gw2/platform/equipment/relics/rules/shared.js';

export const peitha = defineRelic({
  createState: () => ({ readyAt: 0, buffFrom: 0, buffUntil: 0 }),
  timeline(ctx, _state, events, rotationEndTime) {
    // Accepted Deceptions trigger on activation, before their attack animation finishes.
    if (!ctx.helpers) return;
    for (const event of events) {
      if (event.type !== 'action' || event.cancelled || !isGw2PlayerActorEvent(event)) continue;
      const skill = skillForEvent(ctx.helpers, event);
      if (!skill?.categories?.includes('Deception')) continue;
      if (skill.shadowstepSkill) continue;
      const at = event.at;
      if (at > rotationEndTime + EPSILON) continue;
      ctx.queue.enqueue({ ...event, type: 'peitha', at, offTarget: false, projectileDelay: 0.24 });
    }
  },
  peitha(ctx, state, event, applyCondition) {
    const triggerAt = event.at;
    if (!isInternalCooldownReady(triggerAt, state.readyAt)) return;
    state.readyAt = triggerAt + 4;
    const combatStart = Number(ctx.combatStartTime ?? -Infinity);
    const skill = ctx.helpers ? skillForEvent(ctx.helpers, event) : null;
    // Authored movement delays include launch latency and travel; legacy events already denote projectile impact.
    // Clamp pre-combat impacts so their conditions cannot preload before combat.
    const impactAt =
      triggerAt < combatStart
        ? combatStart
        : triggerAt +
          Math.max(
            0,
            Number(event.projectileDelay ?? (event.type === 'shadowstep' ? (skill?.peithaProjectileDelay ?? 0.24) : 0))
          );
    state.buffFrom = impactAt;
    state.buffUntil = gw2EffectExpiresAt(impactAt, 4);
    ctx.recordProc('relic', 'Relic of Peitha', impactAt, event.skillName, '', '', null, Number(state.buffUntil));
    applyCondition(ctx, {
      type: 'condition',
      at: impactAt,
      name: 'Relic of Peitha — Torment',
      skillName: 'Relic of Peitha',
      condition: 'Torment',
      duration: 7,
      stacks: 2,
      source: 'Relic',
      actorType: 'effect',
      ownerActorType: 'player',
      sourceId: 'relic.peitha',
      activationId: event.activationId,
      triggeredBy: event.skillName
    });
  },
  // Follow-up strikes inherit their owner's Peitha bonus; summoned actors remain excluded.
  strikeMultiplier: timedStrikeBuff(1.1, isGw2PlayerModifierOwnedEvent)
});
