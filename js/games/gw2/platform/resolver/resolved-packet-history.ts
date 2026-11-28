/** Retain resolved packets for one run, sharing live condition applications until result projection. */
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';

export interface ConditionDamageTick {
  readonly at: number;
  readonly damage: number;
  readonly fraction: number;
}

export type ResolvedPacketOutput = 'detailed' | 'score' | 'damage' | 'observations';

declare const preparedHitBrand: unique symbol;

/** Only prepareHit creates this type, so recordHit cannot publish a row that skipped the retention check. */
export type PreparedHit = Gw2ResolverEvent & { readonly [preparedHitBrand]: true };

/** Resolver handlers record report rows here; the output mode decides which rows the run keeps. */
export interface ResolvedPacketWriter {
  /** Score runs keep no rows, so hit resolution can skip building one. */
  readonly retainsRows: boolean;
  record(event: Gw2ResolverEvent): void;
  recordConditionTick(
    application: Gw2ResolverEvent & { readonly damageTicks: ConditionDamageTick[] },
    at: number,
    damage: number,
    fraction: number
  ): void;
  prepareHit(row: Gw2ResolverEvent): PreparedHit | undefined;
  recordHit(row: PreparedHit | undefined, damage: number): void;
}

export function createResolvedPacketHistory(
  output: ResolvedPacketOutput,
  ownsEffect?: (event: Gw2ResolverEvent) => boolean
) {
  if (output === 'damage' && !ownsEffect) throw new TypeError('Damage measurements require an effect owner.');

  const events: Gw2ResolverEvent[] = [];
  // Detailed keeps every row, observations keeps damage and conditions, damage keeps the measured owner's packets, and
  // score keeps none. Gameplay history is separate from these report rows.
  const retains = (event: Gw2ResolverEvent) =>
    output === 'detailed' ||
    (output === 'observations' && (event.type === 'damage' || event.type === 'condition')) ||
    (output === 'damage' && ownsEffect!(event));

  const writer: ResolvedPacketWriter = Object.freeze({
    retainsRows: output !== 'score',
    record(event: Gw2ResolverEvent): void {
      if (retains(event)) events.push(event);
    },
    recordConditionTick(
      application: Gw2ResolverEvent & { readonly damageTicks: ConditionDamageTick[] },
      at: number,
      damage: number,
      fraction: number
    ): void {
      if (retains(application)) application.damageTicks.push({ at, damage, fraction });
    },
    /** Accept a built hit before diagnostics sample the target; measurements check its resolved activation. */
    prepareHit(row: Gw2ResolverEvent): PreparedHit | undefined {
      return retains(row) ? (row as PreparedHit) : undefined;
    },
    /** Publish the prepared hit after settlement supplies the encounter-accepted damage. */
    recordHit(row: PreparedHit | undefined, damage: number): void {
      if (row) events.push(Object.assign(row, { damage }));
    }
  });

  return { events: events as readonly Gw2ResolverEvent[], writer };
}
