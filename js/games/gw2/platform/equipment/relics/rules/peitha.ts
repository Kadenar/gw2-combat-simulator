import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
/** Peitha relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic, timedStrikeBuff } from '#gw2/platform/equipment/relics/rules/shared.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { clamp } from '#kernel/core/numeric.js';

/** Activation-to-impact delay for qualifying skills without a measured `peithaImpactDelayMs`. */
const PEITHA_DEFAULT_IMPACT_DELAY_MS = 240;

export const peitha = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({ readyAt: 0, buffFrom: 0, buffUntil: 0 }),
  // Every profession shares one trigger: a committed player activation of a shadowstep or Deception skill.
  // The trigger stays at activation so the internal cooldown gates on use; the skill supplies the impact delay.
  emitActionEffects(ctx, _state, event, skill) {
    if (!isGw2PlayerActorEvent(event)) return;
    if (!skill?.shadowstepSkill && !skill?.categories?.includes('Deception')) return;
    // Cast-end anchors follow variants whose cast length changes per activation; the event stores the total from activation.
    const anchorOffsetMs =
      skill.peithaImpactAnchor === 'castEnd' ? (Number(event.fullEndsAt ?? event.at) - event.at) * 1000 : 0;
    ctx.effects.emit({
      kind: 'packet',
      cause: event,
      event: {
        type: 'peitha',
        at: event.at,
        source: event.source,
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: 'Relic of Peitha',
        peithaImpactDelayMs: anchorOffsetMs + (skill.peithaImpactDelayMs ?? PEITHA_DEFAULT_IMPACT_DELAY_MS)
      }
    });
  },
  peitha(ctx, state, event) {
    const triggerAt = event.at;
    if (!isInternalCooldownReady(triggerAt, state.readyAt)) return;
    state.readyAt = triggerAt + 4;
    emitDamagePayload(ctx, state, event);
  },
  // Follow-up strikes inherit their owner's Peitha bonus; summoned actors remain excluded.
  strikeMultiplier: timedStrikeBuff(1.1, isGw2PlayerModifierOwnedEvent)
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(
  ctx: Gw2RelicContext,
  state: Gw2RelicState,
  event: SimulationEvent,
  inputs: import('#gw2/platform/skill-damage/types.js').DamageInputs = {}
): void {
  const combatStart = ctx.combatStartTime ?? -Infinity;
  // The trigger carries its skill's launch latency and travel; only impacts that would still land before
  // combat clamp to combat start, so their conditions cannot preload.
  const impactAt = clamp(
    event.at +
      Math.max(0, Number(inputs.impactDelayMs ?? event.peithaImpactDelayMs ?? PEITHA_DEFAULT_IMPACT_DELAY_MS)) / 1000,
    combatStart,
    Infinity
  );
  state.buffFrom = impactAt;
  state.buffUntil = gw2EffectExpiresAt(impactAt, 4);
  ctx.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'relic',
      name: 'Relic of Peitha',
      at: impactAt,
      sourceSkill: event.skillName,
      detail: '',
      icon: '',
      cooldownReduction: null,
      expiresAt: state.buffUntil
    }
  });
  // Delayed impacts enter the common queue so duration and condition reactions see impact-time state.
  ctx.effects.emit({
    kind: 'packet',
    event: {
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
      sourceId: `relic.${RELIC_IDS.PEITHA}`,
      activationId: event.activationId,
      triggeredBy: event.skillName
    }
  });
}
