import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { canonicalTime } from '#kernel/core/clock.js';

export interface AlliedStrikeOpportunity {
  readonly allyIndex: number;
  readonly at: number;
  readonly activationId: string;
}

export interface AlliedStrikeGrant {
  readonly id: string;
  readonly allyIndex: number;
  readonly expiresAt?: number;
  readonly inclusiveExpiry?: boolean;
  readonly charges?: number;
  readonly internalCooldown?: number;
  /** Existing profession state can retire a grant when its charges or upkeep end. */
  readonly isActive?: () => boolean;
  /** Stacked batches in one group consume at most one charge per allied strike. */
  readonly consumptionGroup?: string;
  /** Returning false leaves the grant available when its effect-specific eligibility fails. */
  readonly trigger: (opportunity: AlliedStrikeOpportunity) => boolean | void;
}

export interface AlliedStrikeGrants {
  /** Select configured recipients once; targeted audiences retain their original ally index. */
  registerRecipients(
    create: (allyIndex: number) => Omit<AlliedStrikeGrant, 'allyIndex'>,
    recipients?: { maximumAllies?: number; alliedPlayerIndex?: number; allyIndices?: readonly number[] }
  ): void;
}

interface LiveGrant {
  readonly grant: AlliedStrikeGrant;
  charges: number;
  readyAt: number;
  readonly cause: Gw2ResolverEvent | null;
}

/** One engagement-anchored cadence feeds live recipient grants without inventing allied base damage. */
export function createAlliedStrikeController(
  runtime: () => {
    readonly config: Gw2Config;
    readonly time: number;
    readonly deathTime: number | null;
    combatStartedAt(): boolean;
    readonly hasExplicitCombatStart: boolean;
    readonly combatStartTime?: number | null;
  },
  services: {
    schedule(at: number, sequence: number): void;
    captureCause(): Gw2ResolverEvent | null;
    withCause<R>(cause: Gw2ResolverEvent | null, run: () => R): R;
  }
) {
  const grants = new Map<string, LiveGrant>();
  const groupReadyAt = new Map<string, number>();
  let anchor: number | null = null;
  let nextAt: number | null = null;
  let sequence = 0;
  let dispatching = false;
  const liveAt = (live: LiveGrant, at: number): boolean => {
    const end = live.grant.expiresAt ?? Infinity;
    return live.charges > 0 && (live.grant.inclusiveExpiry ? at <= end : at < end) && (live.grant.isActive?.() ?? true);
  };

  // Exhausted windows leave no heartbeat; re-registration rejoins the original engagement grid.
  function start(): void {
    const context = runtime();
    if (!autonomousActionsAllowed(context)) return;
    anchor ??= context.hasExplicitCombatStart ? context.combatStartTime! : 0;
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

  function register(grant: AlliedStrikeGrant): void {
    grants.set(grant.id, {
      grant: {
        ...grant,
        expiresAt: Number.isFinite(grant.expiresAt) ? canonicalTime(grant.expiresAt!) : grant.expiresAt
      },
      charges: grant.charges ?? Infinity,
      readyAt: -Infinity,
      cause: services.captureCause()
    });
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
      for (const allyIndex of selected) register({ ...create(allyIndex), allyIndex });
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
      return [...grants.values()].flatMap((live) =>
        live.cause && liveAt(live, nextAt!) ? [{ at: nextAt!, cause: live.cause, grant: live.grant }] : []
      );
    },
    strike(expectedSequence: number): void {
      const context = runtime();
      if (expectedSequence !== sequence || nextAt !== context.time) return;
      nextAt = null;
      if (!autonomousActionsAllowed(context)) return;
      const consumed = new Set<string>();
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
          const group = grant.consumptionGroup && `${grant.allyIndex}:${grant.consumptionGroup}`;
          // Recipient ICDs admit the strike landing exactly on the deadline; in-game logs show
          // Vampiric Presence procs at +0.5 s and Soulcleave grants one proc per 1 s window.
          if (
            context.time < live.readyAt ||
            (group && (consumed.has(group) || context.time < (groupReadyAt.get(group) ?? -Infinity)))
          )
            continue;
          if (
            // Parentage belongs to the grant; ordering belongs to this live opportunity.
            services.withCause(live.cause, () =>
              grant.trigger({
                allyIndex: grant.allyIndex,
                at: context.time,
                activationId: `allied-strike:${grant.allyIndex}:${sequence}`
              })
            ) === false
          )
            continue;
          live.charges--;
          live.readyAt = canonicalTime(context.time + (grant.internalCooldown ?? 0));
          if (group) {
            consumed.add(group);
            groupReadyAt.set(group, live.readyAt);
          }

          if (!liveAt(live, context.time) && grants.get(id) === live) grants.delete(id);
        }
      } finally {
        dispatching = false;
      }

      start();
    }
  };
}
