/**
 * Resolver-only Mesmer trait mechanics whose trigger does not affect later
 * scheduler-owned state.
 */

import { isInternalCooldownReady } from '../../../platform/engine/clock.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { mesmerBalanceProfile, mesmerBalanceProfileEffect, mesmerBalanceValue } from './profiles.js';
import type { MesmerApplyCondition, MesmerResolverContext, MesmerResolverEvent } from '../types.js';

function applyIneptitudeConfusion(
  ctx: MesmerResolverContext,
  event: MesmerResolverEvent,
  detail: string,
  applyCondition: MesmerApplyCondition
): void {
  if (!ctx.traits.has(TRAIT.INEPTITUDE)) return;
  const count = Math.max(1, Math.trunc(Number(event.count || 1)));
  const effect = mesmerBalanceProfileEffect(mesmerBalanceProfile(ctx, TRAIT.INEPTITUDE), 'condition');
  ctx.recordProc('trait', 'Ineptitude', event.at, event.skillName, count > 1 ? `${detail}, ${count} strikes` : detail);
  applyCondition(ctx, {
    type: 'condition',
    at: event.at,
    name: `${event.skillName} — Ineptitude`,
    skillName: event.skillName,
    condition: String(effect?.condition || 'Confusion'),
    duration: Number(effect?.duration || 5),
    stacks: Number(effect?.stacks || 2) * count,
    source: 'Player'
  });
}

/**
 * Interrupting a foe inflicts blind. Only this half of Ineptitude observes the
 * three-second interval against defiant targets.
 */
export function triggerIneptitudeFromInterrupt(
  ctx: MesmerResolverContext,
  event: MesmerResolverEvent,
  applyCondition: MesmerApplyCondition
): void {
  if (!ctx.traits.has(TRAIT.INEPTITUDE)) return;
  const defiant = Boolean(ctx.config.target?.defiant);
  if (defiant && !isInternalCooldownReady(event.at, ctx.profession.ineptitudeReadyAt)) return;
  if (defiant) {
    ctx.profession.ineptitudeReadyAt = event.at + mesmerBalanceValue(ctx, TRAIT.INEPTITUDE, 'internalCooldown', 3);
  }

  applyIneptitudeConfusion(
    ctx,
    { ...event, count: defiant ? 1 : event.count },
    'interrupt → blind → confusion',
    applyCondition
  );
}

/**
 * Blinding a foe inflicts confusion without an internal cooldown, including
 * against defiant targets.
 */
export function triggerIneptitudeFromBlind(
  ctx: MesmerResolverContext,
  event: MesmerResolverEvent,
  applyCondition: MesmerApplyCondition
): void {
  applyIneptitudeConfusion(ctx, event, 'blind → confusion', applyCondition);
}
