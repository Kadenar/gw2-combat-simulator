import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';

export interface DamagePacket {
  readonly at: number;
  readonly damage: number;
  readonly fraction?: number;
}

/** Preserve application shares, including zero-damage fractions, without copying or changing ownership. */
export function recordedDamageTicks(event: Gw2ResolverEvent): readonly DamagePacket[] {
  return Array.isArray(event.damageTicks) ? (event.damageTicks as DamagePacket[]) : [];
}

/** Recorded payouts replace aggregate damage; views without payout history use the event's own amount and time. */
export function eventDamagePackets(event: Gw2ResolverEvent): readonly DamagePacket[] {
  const ticks = recordedDamageTicks(event);
  return ticks.length ? ticks : [{ at: event.at, damage: Number(event.damage || 0) }];
}
