import { buffWindowActive } from '#gw2/platform/combat/buff-expiry.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { defineRelic, playerOwnedRelicSource } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

const PEITHA_BUFF = 'relic-peitha';
const PEITHA_DEFAULT_IMPACT_DELAY_MS = 240;

export const peitha = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({ readyAt: 0 }),
  buffPolicies: [{ kind: PEITHA_BUFF, name: 'Relic of Peitha', maximumStacks: 1 }],
  // Qualifying activations share one cooldown; their delayed payloads settle through ordinary effect handling.
  emitActionEffects(ctx, state, event, skill) {
    if (!isGw2PlayerActorEvent(event)) return;

    if (!skill?.shadowstepSkill && skill?.skillFamily !== 'Deception') return;

    if (!isInternalCooldownReady(event.at, state.readyAt)) return;

    state.readyAt = event.at + 4;
    const anchorOffsetMs =
      skill.peithaImpactAnchor === 'castEnd' ? (Number(event.fullEndsAt ?? event.at) - event.at) * 1000 : 0;
    emitDamagePayload(ctx, event, {
      impactDelayMs: anchorOffsetMs + (skill.peithaImpactDelayMs ?? PEITHA_DEFAULT_IMPACT_DELAY_MS)
    });
  },
  strikeMultiplier(ctx, _state, event) {
    if (!isGw2PlayerModifierOwnedEvent(event)) return 1;

    const at = gw2Time(event.at);
    // The latest eligible grant decides live and historical hits through its inclusive deadline.
    const application = ctx.liveEffects?.queries.latestApplication(PEITHA_BUFF, at, { actor: 'player' });
    return application && buffWindowActive(at, application.at, application.expiresAt, application.removedAt) ? 1.1 : 1;
  }
});

/** Torment and the player's damage buff arrive together, including in isolated damage calculations. */
function emitDamagePayload(
  ctx: Pick<Gw2RelicContext, 'effects' | 'engagement'>,
  event: SimulationEvent,
  inputs: import('#gw2/platform/skill-damage/types.js').DamageInputs = {}
): void {
  const impactAt = Math.max(
    event.at + Math.max(0, Number(inputs.impactDelayMs ?? PEITHA_DEFAULT_IMPACT_DELAY_MS)) / 1000,
    ctx.engagement.startTime ?? -Infinity
  );
  const attribution = {
    ...playerOwnedRelicSource(RELIC_IDS.PEITHA),
    activationId: event.activationId,
    skillName: 'Relic of Peitha',
    triggeredBy: event.skillName
  };
  const proc = ctx.effects.emit({
    receipt: true,
    kind: 'announcement',
    log: true,
    cause: event,
    attribution,
    announcement: {
      type: 'relic',
      name: 'Relic of Peitha',
      at: impactAt,
      sourceSkill: event.skillName,
      expiresAt: gw2EffectExpiresAt(impactAt, 4)
    }
  });
  ctx.effects.emit({
    kind: 'packet',
    cause: proc,
    event: {
      ...attribution,
      type: 'buff',
      at: impactAt,
      name: 'Relic of Peitha',
      kind: PEITHA_BUFF,
      duration: 4,
      stacks: 1,
      audience: { recipients: RECIPIENT.SELF }
    }
  });
  ctx.effects.emit({
    kind: 'packet',
    cause: proc,
    event: {
      ...attribution,
      type: 'condition',
      at: impactAt,
      name: 'Relic of Peitha - Torment',
      condition: CONDITION.TORMENT,
      duration: 7,
      stacks: 2
    }
  });
}
