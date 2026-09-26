/** Peitha relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { clamp } from '#kernel/core/numeric.js';
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { defineRelic, timedStrikeBuff } from '#gw2/platform/equipment/relics/rules/shared.js';

/** Activation-to-impact delay for qualifying skills without a measured `peithaImpactDelayMs`. */
const PEITHA_DEFAULT_IMPACT_DELAY_MS = 240;

export const peitha = defineRelic({
  createState: () => ({ readyAt: 0, buffFrom: 0, buffUntil: 0 }),
  // Every profession shares one trigger: a committed player activation of a shadowstep or Deception skill.
  // The trigger stays at activation so the internal cooldown gates on use; the skill supplies the impact delay.
  emitActionEffects(ctx, _state, event, skill) {
    if (!isGw2PlayerActorEvent(event)) return;
    if (!skill?.shadowstepSkill && !skill?.categories?.includes('Deception')) return;
    // Cast-end anchors follow variants whose cast length changes per activation; the event stores the total from activation.
    const anchorOffsetMs =
      skill.peithaImpactAnchor === 'castEnd' ? (Number(event.fullEndsAt ?? event.at) - event.at) * 1000 : 0;
    ctx.emitDerived(event, {
      type: 'peitha',
      at: event.at,
      source: event.source,
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Relic of Peitha',
      peithaImpactDelayMs: anchorOffsetMs + (skill.peithaImpactDelayMs ?? PEITHA_DEFAULT_IMPACT_DELAY_MS)
    });
  },
  peitha(ctx, state, event) {
    const triggerAt = event.at;
    if (!isInternalCooldownReady(triggerAt, state.readyAt)) return;
    state.readyAt = triggerAt + 4;
    const combatStart = Number(ctx.combatStartTime ?? -Infinity);
    // The trigger carries its skill's launch latency and travel; only impacts that would still land before
    // combat clamp to combat start, so their conditions cannot preload.
    const impactAt = clamp(triggerAt + Math.max(0, Number(event.peithaImpactDelayMs)) / 1000, combatStart, Infinity);
    state.buffFrom = impactAt;
    state.buffUntil = gw2EffectExpiresAt(impactAt, 4);
    ctx.recordProc('relic', 'Relic of Peitha', impactAt, event.skillName, '', '', null, Number(state.buffUntil));
    // Delayed impacts enter the common queue so duration and condition reactions see impact-time state.
    ctx.queue.enqueue({
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
