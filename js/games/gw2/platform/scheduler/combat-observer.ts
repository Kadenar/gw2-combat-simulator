import type { SchedulerContext, SimulationEvent } from '../engine/types.js';
import { GW2_EVENT_ACTOR_TYPES, gw2EventActorType } from '../combat/state/event-ownership.js';
import { canonicalTargetConditionName } from '../combat/state/targets.js';
import type { MaterializerState } from './materializer-state.js';

export interface Gw2CombatObserver {
  observe(context: SchedulerContext, event: SimulationEvent): void;
}

/** Maintains only the combat/query facts derived from canonical events. */
export function createGw2CombatObserver(state: MaterializerState): Readonly<Gw2CombatObserver> {
  const beforeExplicitCombatStart = (context: SchedulerContext, event: SimulationEvent): boolean =>
    context.hasExplicitCombatStart && (context.combatStartTime == null || event.at < context.combatStartTime);

  const activateCombat = (at: number): void => {
    if (!state.combatActive) state.combatBeganAt = Number(at);
    state.combatActive = true;
  };

  const markCombatActive = (context: SchedulerContext, event: SimulationEvent): void => {
    // An explicit marker creates a hard pre-combat boundary. Without one, the
    // first player/summon combat event starts combat implicitly.
    if (beforeExplicitCombatStart(context, event)) return;
    const actorType = gw2EventActorType(event);
    if (actorType === GW2_EVENT_ACTOR_TYPES.PLAYER || actorType === GW2_EVENT_ACTOR_TYPES.SUMMON) {
      activateCombat(event.at);
    }
  };

  const recordBuff = (event: SimulationEvent): void => {
    const kind = String(event.kind || '').toLowerCase();
    const applications = state.boons.get(kind) || [];
    applications.push({
      at: event.at,
      expiresAt: event.at + Math.max(0, Number(event.duration || 0)),
      stacks: Math.max(1, Number(event.stacks || 1)),
      source: event.source,
      affectsSelf: event.affectsSelf !== false,
      affectsSummons: event.affectsSummons === true,
      alliedPlayerCount: Math.max(0, Math.trunc(Number(event.alliedPlayerCount || 0))),
      companionIds: Array.isArray(event.companionIds) ? event.companionIds.map(String) : [],
      recipientCount: Math.max(0, Math.trunc(Number(event.recipientCount || 0)))
    });
    // Historical applications stay in the map because combat queries ask about
    // arbitrary event timestamps, not only the scheduler's current clock.
    state.boons.set(kind, applications);
  };

  const recordCondition = (event: SimulationEvent): void => {
    const name = canonicalTargetConditionName(event.condition);
    const query = state.query!;
    const stats = query.statsAt(event.at, event, state);
    const durationMultiplier = event.fixedDuration
      ? 1
      : query.conditionDurationMultiplier(name, event.at, stats, event, state);
    const baseDurationMultiplier = event.fixedDuration
      ? 1
      : (query.conditionBaseDurationMultiplier?.(name, event.at, event, state) ?? 1);
    const duration = Math.max(0, Number(event.duration || 0)) * baseDurationMultiplier * durationMultiplier;
    const stacks = Math.max(0, Number(event.stacks || 0));
    if (!(duration > 0) || !(stacks > 0)) return;
    const entry = state.conditionState.get(name) || { stacks: [] };
    entry.stacks.push({
      appliedAt: event.at,
      expiresAt: event.at + duration,
      weight: stacks
    });
    state.conditionState.set(name, entry);
  };

  return Object.freeze({
    observe(context: SchedulerContext, event: SimulationEvent) {
      switch (event.type) {
        case 'combat_start':
          activateCombat(event.at);
          break;
        case 'buff':
          recordBuff(event);
          break;
        case 'condition':
          markCombatActive(context, event);
          if (state.combatActive) recordCondition(event);
          break;
        case 'damage':
        case 'control':
        case 'blind':
          markCombatActive(context, event);
          break;
        case 'weapon_set':
          state.activeWeaponSet = Number(event.weaponSet) === 2 ? 2 : 1;
          break;
        default:
          break;
      }
    }
  });
}
