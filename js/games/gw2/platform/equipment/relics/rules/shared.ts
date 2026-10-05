import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { relicIdForName } from '#gw2/platform/equipment/relics/catalog.js';
/** Helpers shared by more than one relic rule module. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { targetHasCondition } from '#gw2/platform/combat/state/targets.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2RelicState, Gw2RelicContext, Gw2RelicRule } from '#gw2/platform/equipment/relics/types.js';

interface TimedBuffProcOptions {
  readonly relicId: number;
  readonly kind: string;
  readonly duration: number;
  readonly name: string;
  readonly detail?: string | null;
}

export function compareTimelineEvents(left: SimulationEvent, right: SimulationEvent): number {
  return (
    left.at - right.at || (left.causalOrder ?? left.eventOrder ?? 0) - (right.causalOrder ?? right.eventOrder ?? 0)
  );
}

export function explicitCombatStartTime(events: readonly SimulationEvent[]): number {
  let combatStartTime = Infinity;
  for (const event of events) {
    if (event.type === 'combat_start') {
      combatStartTime = Math.min(combatStartTime, event.at);
    }
  }

  return combatStartTime === Infinity ? -Infinity : combatStartTime;
}

export function defineRelic(rules: Gw2RelicRule): Readonly<Gw2RelicRule> {
  return Object.freeze(rules);
}

/** Accepted independent windows preserve the longest expiry without another mutable lifetime owner. */
export function recordTimedBuffProc(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
  { relicId, kind, duration, name, detail = null }: TimedBuffProcOptions
): void {
  const wasActive = relicBuffActive(ctx, kind, event.at);
  const expiresAt = Math.max(
    gw2EffectExpiresAt(event.at, duration),
    ...(ctx.buffs?.get(kind) ?? [])
      .filter((application) => application.at <= event.at && application.resolvedAudience.includesSelf)
      .map((application) => application.expiresAt)
  );
  const proc = ctx.effects.emit({
    kind: 'announcement',
    cause: event,
    announcement: {
      type: 'relic',
      name,
      at: event.at,
      sourceSkill: event.skillName,
      detail: detail ?? (wasActive ? 'refreshed' : 'activated'),
      icon: '',
      cooldownReduction: null,
      expiresAt
    }
  });
  ctx.effects.emit({
    kind: 'packet',
    cause: proc,
    settlement: 'reaction',
    event: {
      type: 'buff',
      kind,
      at: event.at,
      duration,
      stacks: 1,
      source: 'Relic',
      sourceId: `relic.${relicId}`,
      actorType: 'effect',
      ownerActorType: 'player',
      name,
      skillName: name,
      triggeredBy: event.skillName,
      activationId: event.activationId,
      audience: { recipients: 'self' }
    }
  });
}

/** Relic modifiers query only accepted self applications, including historical intervals. */
export function relicBuffActive(ctx: Pick<Gw2RelicContext, 'buffs'>, kind: string, at: number): boolean {
  return buffApplicationStacks(ctx.buffs?.get(kind) ?? [], kind, at, 1) > 0;
}

/** Actor eligibility is independent of the accepted non-boon lifetime. */
export function timedStrikeBuff(
  kind: string,
  multiplier: number,
  predicate?: (event: SimulationEvent) => boolean
): NonNullable<Gw2RelicRule['strikeMultiplier']> {
  return (ctx, _state, event) =>
    relicBuffActive(ctx, kind, event.at) && (predicate ? predicate(event) : true) ? multiplier : 1;
}

/** Activates buffs from live completed slot skills, retaining precombat elapsed time and each relic's own cooldown. */
export function skillUseStrikeRelic(skillType: 'Heal' | 'Elite'): Readonly<Gw2RelicRule> {
  const director = skillType === 'Heal';
  const relicId = director ? RELIC_IDS.DIRECTOR : RELIC_IDS.MOUNT_BALRIOR;
  const name = director ? 'Relic of the Director' : 'Relic of Mount Balrior';
  const kind = director ? 'relic-director' : 'relic-mount-balrior';
  function activate(ctx: Gw2RelicContext, _state: Gw2RelicState, event: SimulationEvent) {
    const at = event.at;
    recordTimedBuffProc(ctx, event, { relicId, kind, duration: 6, name });
    if (director) {
      ctx.effects.emit({
        kind: 'packet',
        event: {
          type: 'condition',
          at,
          source: 'Relic',
          sourceId: `relic.${RELIC_IDS.DIRECTOR}`,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: name,
          name,
          triggeredBy: event.skillName,
          offTarget: Boolean(event.offTarget),
          condition: 'Vulnerability',
          stacks: 8,
          duration: 8
        }
      });
    }
  }

  return defineRelic({
    buffPolicies: [{ kind, maximumStacks: 1 }],
    createState: () => ({ readyAt: -Infinity }),
    activate,
    completed(ctx, state, event) {
      if (event.skillType !== skillType || event.cancelled || !isGw2PlayerActorEvent(event)) return;
      // The runtime supplies completion time and whether the marker has executed; pending casts cannot activate buffs.
      const precombat = event.precombat === true;
      if (
        precombat
          ? !ctx.config.precastRelics?.some((name) => relicIdForName(name) === relicId)
          : ctx.relic?.id !== relicId
      )
        return;
      if (!isInternalCooldownReady(event.at, state.readyAt)) return;
      state.readyAt = event.at + (director ? 15 : 30);
      ctx.effects.emit({
        kind: 'packet',
        event: { ...event, type: 'relic.activate', sourceId: relicId, at: event.at + (director ? 0 : 1) }
      });
    },
    strikeMultiplier(ctx, _state, event) {
      const active = relicBuffActive(ctx, kind, event.at);
      return active &&
        isGw2PlayerModifierOwnedEvent(event) &&
        (!director || targetHasCondition(ctx.config, 'Vulnerability', event.at, ctx))
        ? director
          ? 1.1
          : 1.15
        : 1;
    }
  });
}
