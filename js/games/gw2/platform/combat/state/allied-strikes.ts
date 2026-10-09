import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
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
  /** Stacked batches in one group consume at most one charge per allied strike. */
  readonly consumptionGroup?: string;
  /** Returning false leaves the grant available when its effect-specific eligibility fails. */
  readonly trigger: (opportunity: AlliedStrikeOpportunity) => boolean | void;
}

export interface AlliedStrikeGrants {
  register(grant: AlliedStrikeGrant): void;
}

interface LiveGrant {
  readonly grant: AlliedStrikeGrant;
  charges: number;
  readyAt: number;
}

/** One engagement-anchored cadence feeds live recipient grants without inventing allied base damage. */
export function createAlliedStrikeController(
  runtime: () => {
    readonly config: Gw2Config;
    readonly time: number;
    readonly deathTime: number | null;
    readonly hasExplicitCombatStart: boolean;
    readonly combatActive: boolean;
  },
  schedule: (at: number, sequence: number) => void
) {
  const grants = new Map<string, LiveGrant>();
  const groupReadyAt = new Map<string, number>();
  let anchor: number | null = null;
  let sequence = 0;
  const register = (grant: AlliedStrikeGrant): void => {
    const party = gw2AlliedPlayerAssumptions(runtime().config);
    if (grant.allyIndex < 1 || grant.allyIndex > party.count || !party.strikesPerSecond) return;
    grants.set(grant.id, {
      grant: {
        ...grant,
        expiresAt: Number.isFinite(grant.expiresAt) ? canonicalTime(grant.expiresAt!) : grant.expiresAt
      },
      charges: grant.charges ?? Infinity,
      readyAt: -Infinity
    });
  };

  const next = (): void => {
    const rate = gw2AlliedPlayerAssumptions(runtime().config).strikesPerSecond;
    schedule(canonicalTime(anchor! + ++sequence / rate), sequence);
  };

  return {
    grants: Object.freeze({ register }),
    start(): void {
      const context = runtime();
      const party = gw2AlliedPlayerAssumptions(context.config);
      if (anchor != null || !autonomousActionsAllowed(context) || !party.count || !party.strikesPerSecond) return;
      anchor = context.time;
      next();
    },
    strike(expectedSequence: number): void {
      const context = runtime();
      if (expectedSequence !== sequence || !autonomousActionsAllowed(context)) return;
      const consumed = new Set<string>();
      // Snapshot membership: a proc cannot recursively consume a grant created by that same opportunity.
      for (const [id, live] of [...grants]) {
        const { grant } = live;
        const expiresAt = grant.expiresAt ?? Infinity;
        if (live.charges <= 0 || (grant.inclusiveExpiry ? context.time > expiresAt : context.time >= expiresAt)) {
          grants.delete(id);
          continue;
        }

        const group = grant.consumptionGroup && `${grant.allyIndex}:${grant.consumptionGroup}`;
        if (
          context.time < live.readyAt ||
          (group && (consumed.has(group) || context.time < (groupReadyAt.get(group) ?? -Infinity)))
        )
          continue;
        if (
          grant.trigger({
            allyIndex: grant.allyIndex,
            at: context.time,
            activationId: `allied-strike:${grant.allyIndex}:${sequence}`
          }) === false
        )
          continue;
        live.charges--;
        live.readyAt = canonicalTime(context.time + (grant.internalCooldown ?? 0));
        if (group) {
          consumed.add(group);
          groupReadyAt.set(group, live.readyAt);
        }
      }

      next();
    }
  };
}
