import { autonomousActionsAllowed, type CombatEngagementQueries } from '#gw2/platform/combat/engagement.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { canonicalTime } from '#kernel/core/clock.js';

export interface AlliedStrikeOpportunity {
  readonly allyIndex: number;
  readonly at: number;
  readonly activationId: string;
}

/**
 * A recipient's interest in allied strikes. The owning mechanic keeps the recipient's charges, expiry, and cooldowns in
 * its own state; the controller supplies only the shared strike cadence and the grant's causal parent.
 */
export interface AlliedStrikeGrant {
  readonly id: string;
  readonly allyIndex: number;
  /** Whether the native grant is live at an opportunity time, including future opportunities being scheduled. */
  readonly isActive?: (at: number) => boolean;
  /** Batched owners name the cause of the batch an opportunity would spend; otherwise the registering cause applies. */
  readonly causeAt?: (at: number) => Gw2ResolverEvent | null;
  /** Returning false leaves the grant registered when its effect-specific eligibility fails. */
  readonly trigger: (opportunity: AlliedStrikeOpportunity) => boolean | void;
}

export interface AlliedStrikeGrants {
  /**
   * Select configured recipients once; targeted audiences retain their original ally index. Each recipient receives
   * the registering cause so native batches that outlive a replaced registration can keep their own parent.
   */
  registerRecipients(
    create: (allyIndex: number, cause: Gw2ResolverEvent | null) => Omit<AlliedStrikeGrant, 'allyIndex'>,
    recipients?: { maximumAllies?: number; alliedPlayerIndex?: number; allyIndices?: readonly number[] }
  ): void;
}

interface LiveGrant {
  readonly grant: AlliedStrikeGrant;
  readonly cause: Gw2ResolverEvent | null;
}

/** One engagement-anchored cadence feeds live recipient grants without inventing allied base damage. */
export function createAlliedStrikeController(
  runtime: () => {
    readonly config: Gw2Config;
    readonly time: number;
    readonly deathTime: number | null;
    readonly engagement: CombatEngagementQueries;
  },
  services: {
    schedule(at: number, sequence: number): void;
    captureCause(): Gw2ResolverEvent | null;
    withCause<R>(cause: Gw2ResolverEvent | null, run: () => R): R;
  }
) {
  const grants = new Map<string, LiveGrant>();
  let anchor: number | null = null;
  let nextAt: number | null = null;
  let sequence = 0;
  let dispatching = false;
  const liveAt = (live: LiveGrant, at: number): boolean => live.grant.isActive?.(at) ?? true;
  const causeAt = (live: LiveGrant, at: number): Gw2ResolverEvent | null => live.grant.causeAt?.(at) ?? live.cause;

  // Exhausted windows leave no heartbeat; re-registration rejoins the original engagement grid.
  function start(): void {
    const context = runtime();

    if (!autonomousActionsAllowed(context)) return;

    anchor ??= context.engagement.explicit ? context.engagement.startTime! : 0;

    if (nextAt != null || dispatching) return;

    const party = gw2AlliedPlayerAssumptions(context.config);

    if (!party.count || !party.strikesPerSecond) return;

    for (const [id, live] of grants) if (!liveAt(live, context.time)) grants.delete(id);

    if (!grants.size) return;

    let nextSequence = Math.max(sequence + 1, Math.floor((context.time - anchor) * party.strikesPerSecond) + 1);
    let at = canonicalTime(anchor + nextSequence / party.strikesPerSecond);

    // A grant accepted after the same-time opportunity cannot replay that opportunity.
    if (at <= context.time) at = canonicalTime(anchor + ++nextSequence / party.strikesPerSecond);

    if (![...grants.values()].some((live) => liveAt(live, at))) return;

    sequence = nextSequence;
    nextAt = at;
    services.schedule(at, sequence);
  }

  const capability: AlliedStrikeGrants = {
    registerRecipients(create, recipients = {}) {
      const { count, strikesPerSecond } = gw2AlliedPlayerAssumptions(runtime().config);

      // A rejected opportunity cannot create profession-owned recipient charges as a callback side effect.
      if (!strikesPerSecond) return;

      const indices =
        recipients.allyIndices ??
        (recipients.alliedPlayerIndex == null
          ? Array.from({ length: count }, (_, i) => i + 1)
          : [recipients.alliedPlayerIndex]);
      const selected = [...new Set(indices)]
        .filter((i) => Number.isInteger(i) && i > 0 && i <= count)
        .slice(0, Math.max(0, Math.trunc(recipients.maximumAllies ?? count)));
      const cause = services.captureCause();
      // Reusing an ID replaces that recipient's registration without moving the shared cadence.
      for (const allyIndex of selected) {
        const grant = { ...create(allyIndex, cause), allyIndex };
        grants.set(grant.id, { grant, cause });
      }

      // Publish the whole party before scanning eligibility and scheduling its shared opportunity.
      start();
    }
  };
  return {
    grants: Object.freeze(capability),
    start,
    // Expose pending grant ownership; the observation policy decides which deadlines to follow.
    pendingEffects(): { at: number; cause: Gw2ResolverEvent; grant: AlliedStrikeGrant }[] {
      if (nextAt == null) return [];

      return [...grants.values()].flatMap((live) => {
        const cause = liveAt(live, nextAt!) ? causeAt(live, nextAt!) : null;
        return cause ? [{ at: nextAt!, cause, grant: live.grant }] : [];
      });
    },
    strike(expectedSequence: number): void {
      const context = runtime();

      if (expectedSequence !== sequence || nextAt !== context.time) return;

      nextAt = null;

      if (!autonomousActionsAllowed(context)) return;

      dispatching = true;
      try {
        // Freeze membership before callbacks: new grants wait for the next causal strike.
        for (const [id, live] of [...grants]) {
          if (grants.get(id) !== live) continue;

          if (!liveAt(live, context.time)) {
            grants.delete(id);
            continue;
          }

          const { grant } = live;

          if (
            // Parentage belongs to the grant; ordering belongs to this live opportunity.
            services.withCause(causeAt(live, context.time), () =>
              grant.trigger({
                allyIndex: grant.allyIndex,
                at: context.time,
                activationId: `allied-strike:${grant.allyIndex}:${sequence}`
              })
            ) === false
          )
            continue;

          // A spend can exhaust the native grant; retire it unless the trigger already replaced it.
          if (!liveAt(live, context.time) && grants.get(id) === live) grants.delete(id);
        }
      } finally {
        dispatching = false;
      }

      start();
    }
  };
}
