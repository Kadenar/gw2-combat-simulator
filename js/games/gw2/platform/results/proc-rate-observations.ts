/** Counts proc rolls per random stream and projects the build's overridable proc rates for Analysis. */
import { availableProcRateProfiles } from '#gw2/platform/builds/proc-rates.js';
import type { ProcCooldownBlockObserver } from '#gw2/platform/combat/procs/registry.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import { gw2SigilIds } from '#gw2/platform/equipment/sigils/loadout.js';
import { SEVERANCE_PROC_RATE } from '#gw2/platform/equipment/sigils/severance.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { clamp } from '#kernel/core/numeric.js';
import type { SimulationRandom } from '#kernel/core/simulation-random.js';

interface ProcRollTally {
  rolls: number;
  successes: number;
  /** Sum of each roll's chance: the mean success count. */
  expectedSuccesses: number;
  /** Sum of p(1 - p): the binomial variance of the success count. */
  successVariance: number;
  cooldownBlocked: number;
}

/**
 * Reporting-only roll counts; observing a random source never changes an outcome or a stream's sequence.
 * Its cooldownBlocked method counts eligible triggers that an active internal cooldown kept from rolling.
 */
export interface ProcRollObserver extends ProcCooldownBlockObserver {
  observe(random: Readonly<SimulationRandom>): Readonly<SimulationRandom>;
  tallies(): ReadonlyMap<string, Readonly<ProcRollTally>>;
}

export function createProcRollRecorder(): ProcRollObserver {
  const tallies = new Map<string, ProcRollTally>();
  const tally = (stream: string): ProcRollTally => {
    let current = tallies.get(stream);

    if (!current) {
      current = { rolls: 0, successes: 0, expectedSuccesses: 0, successVariance: 0, cooldownBlocked: 0 };
      tallies.set(stream, current);
    }

    return current;
  };

  return {
    observe(random) {
      return Object.freeze({
        mode: random.mode,
        seed: random.seed,
        next: (stream?: string) => random.next(stream),
        roll(probability: number, stream = 'default'): boolean {
          const success = random.roll(probability, stream);
          // Match the source's clamp so expected counts use the chance that was actually rolled.
          const chance = clamp(probability || 0, 0, 1);
          const current = tally(stream || 'default');
          current.rolls += 1;
          current.successes += success ? 1 : 0;
          current.expectedSuccesses += chance;
          current.successVariance += chance * (1 - chance);
          return success;
        }
      });
    },
    cooldownBlocked(stream, opportunities) {
      tally(stream).cooldownBlocked += opportunities;
    },
    tallies: () => tallies
  };
}

/** One overridable proc's configured chance beside what a single run observed. */
export interface Gw2ProcRateObservation {
  /** Override key shared with build assumptions. */
  readonly id: string;
  readonly name: string;
  /** Chance per eligible trigger: the override when set, otherwise the balance default. */
  readonly chance: number;
  /** Balance or sigil default, shown beside a custom chance for comparison. */
  readonly defaultChance: number;
  readonly custom: boolean;
  /** What one eligible trigger is, worded as on the override control. */
  readonly opportunity: string;
  readonly triggers: number;
  readonly procs: number;
  /** Mean and binomial variance of the proc count for the observed triggers. */
  readonly expectedProcs: number;
  readonly procVariance: number;
  /** Eligible triggers that arrived during an internal cooldown and never rolled. */
  readonly cooldownBlocked: number;
}

interface ProcRateProjectionContext {
  readonly config: Gw2Config;
  readonly traits: ReadonlySet<SkillId>;
  readonly helpers: Pick<CanonicalCatalog, 'balanceProfilesById'>;
  readonly procRollRecorder: ProcRollObserver | null;
}

/**
 * Lists every overridable proc the run could trigger, including procs with no triggers, so a missing
 * opportunity stays visible. A proc owns the stream named by its ID and any stream namespaced beneath it.
 */
export function projectProcRateObservations(ctx: ProcRateProjectionContext): Gw2ProcRateObservation[] {
  if (!ctx.procRollRecorder) return [];

  const overrides = ctx.config.procRateOverrides || {};
  const severanceEquipped = [1, 2].some((set) => gw2SigilIds(ctx.config, set).includes(SIGIL_IDS.SEVERANCE));
  const declarations = [
    ...availableProcRateProfiles(ctx.helpers, [...ctx.traits]).map((profile) => ({
      id: profile.procRate!.id,
      name: profile.name,
      defaultChance: balanceProfileNumber(profile, profile.procRate!.field),
      opportunity: profile.procRate!.opportunity
    })),
    ...(severanceEquipped ? [SEVERANCE_PROC_RATE] : [])
  ];
  const tallies = [...ctx.procRollRecorder.tallies()];

  return declarations.map((declaration) => {
    const owned = tallies.filter(([stream]) => stream === declaration.id || stream.startsWith(`${declaration.id}.`));
    const sum = (field: keyof ProcRollTally): number => owned.reduce((total, [, tally]) => total + tally[field], 0);
    const override = overrides[declaration.id];
    return {
      id: declaration.id,
      name: declaration.name,
      chance: override ?? declaration.defaultChance,
      defaultChance: declaration.defaultChance,
      custom: override !== undefined,
      opportunity: declaration.opportunity,
      triggers: sum('rolls'),
      procs: sum('successes'),
      expectedProcs: sum('expectedSuccesses'),
      procVariance: sum('successVariance'),
      cooldownBlocked: sum('cooldownBlocked')
    };
  });
}
