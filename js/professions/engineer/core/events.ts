import { enqueueOrdered } from '../../../platform/engine/event-queue.js';
import { professionCoreState } from '../../../platform/engine/profession.js';
import { applyCondition, queueDamage } from './shared.js';
import { snapshotEngineerState } from '../state.js';
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerSchedulerContext,
  EngineerSkill
} from '../types.js';

// state snapshot is embedded in the event so the resolver can apply it without re-reading scheduler memory
export function emitEngineerState(context: EngineerSchedulerContext, at: number, reason: string): void {
  context.emit({
    type: 'engineer.state',
    at,
    source: 'engineer',
    sourceId: `engineer.state.${reason}`,
    actorType: 'player',
    reason,
    state: snapshotEngineerState(context.state.profession)
  });
}

// kit equip/stow is treated as a weapon bar swap by the sigil system — must emit sigil_swap (not a custom type)
export function emitEngineerBarSwap(context: EngineerSchedulerContext, skill: EngineerSkill, at: number): void {
  context.emit({
    type: 'sigil_swap',
    at,
    source: 'engineer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet
  });
}

// Focused is the shared spear target window established by Conduit Surge.
function focused(context: EngineerResolverContext, at: number): boolean {
  return Number(professionCoreState(context).focusedUntil || 0) > at;
}

export function handleLightningRodPulse(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const isFocused = focused(context, event.at);
  queueDamage(context, event, {
    name: 'Lightning Rod',
    coefficient: isFocused ? 0.3 : 0.17
  });
  // Immobilize only on the second hit (hitIndex 1, 0-based) — not every pulse
  if (event.hitIndex === 1) {
    applyCondition({}, context, event, {
      name: 'Lightning Rod',
      condition: 'Immobilized',
      stacks: 1,
      duration: 2
    });
  }
}

export function handleConduitSurge(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Math.max preserves a longer existing Focused window; Conduit Surge must not shorten it
  professionCoreState(context).focusedUntil = Math.max(
    Number(professionCoreState(context).focusedUntil || 0),
    event.at + 10
  );
  queueDamage(context, event, {
    name: 'Conduit Surge',
    coefficient: 1.2
  });
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    name: 'Conduit Surge — Burning',
    skillName: 'Conduit Surge',
    condition: 'Burning',
    stacks: 1,
    duration: 7,
    source: 'engineer',
    sourceId: event.skillId ?? event.sourceId,
    actorType: 'player'
  });
}

export function handleElectricArtillery(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const isFocused = focused(context, event.at);
  // charges accumulate from Lightning Rod hits (max 12); Math.trunc discards partial charges
  const charges = Math.max(0, Math.min(12, Math.trunc(Number(event.charges || 0))));
  queueDamage(context, event, {
    name: 'Electric Artillery',
    coefficient: isFocused ? 1.5 : 1,
    explosion: true
  });
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    name: 'Electric Artillery — Burning',
    skillName: 'Electric Artillery',
    condition: 'Burning',
    stacks: 2,
    duration: 3 + charges * (isFocused ? 0.5 : 0.25),
    source: 'engineer',
    sourceId: event.skillId ?? event.sourceId,
    actorType: 'player'
  });
}
