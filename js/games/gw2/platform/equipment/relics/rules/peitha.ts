import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';

const PEITHA_BUFF = 'relic-peitha';
const PEITHA_DEFAULT_IMPACT_DELAY_MS = 240;

export const peitha = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({ readyAt: 0 }),
  buffPolicies: [{ kind: PEITHA_BUFF, maximumStacks: 1 }],
  // Qualifying activations share one cooldown; their delayed payloads settle through ordinary effect handling.
  emitActionEffects(ctx, state, event, skill) {
    if (!isGw2PlayerActorEvent(event)) return;
    if (!skill?.shadowstepSkill && !skill?.categories?.includes('Deception')) return;
    if (!isInternalCooldownReady(event.at, state.readyAt)) return;
    state.readyAt = event.at + 4;
    const anchorOffsetMs =
      skill.peithaImpactAnchor === 'castEnd' ? (Number(event.fullEndsAt ?? event.at) - event.at) * 1000 : 0;
    emitDamagePayload(ctx, state, event, {
      impactDelayMs: anchorOffsetMs + (skill.peithaImpactDelayMs ?? PEITHA_DEFAULT_IMPACT_DELAY_MS)
    });
  },
  strikeMultiplier(ctx, _state, event) {
    return isGw2PlayerModifierOwnedEvent(event) &&
      buffApplicationStacks(ctx.buffs?.get(PEITHA_BUFF) ?? [], PEITHA_BUFF, event.at, 1) > 0
      ? 1.1
      : 1;
  }
});

/** Torment and the player's damage buff arrive together, including in isolated damage calculations. */
function emitDamagePayload(
  ctx: Pick<Gw2RelicContext, 'effects' | 'combatStartTime'>,
  _state: Gw2RelicState,
  event: SimulationEvent,
  inputs: import('#gw2/platform/skill-damage/types.js').DamageInputs = {}
): void {
  const impactAt = Math.max(
    event.at + Math.max(0, Number(inputs.impactDelayMs ?? PEITHA_DEFAULT_IMPACT_DELAY_MS)) / 1000,
    ctx.combatStartTime ?? -Infinity
  );
  const attribution = {
    source: 'Relic',
    sourceId: `relic.${RELIC_IDS.PEITHA}`,
    actorType: 'effect' as const,
    ownerActorType: 'player' as const,
    activationId: event.activationId,
    skillName: 'Relic of Peitha',
    triggeredBy: event.skillName
  };
  const proc = ctx.effects.emit({
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
      audience: { recipients: 'self' }
    }
  });
  ctx.effects.emit({
    kind: 'packet',
    cause: proc,
    event: {
      ...attribution,
      type: 'condition',
      at: impactAt,
      name: 'Relic of Peitha — Torment',
      condition: 'Torment',
      duration: 7,
      stacks: 2
    }
  });
}
