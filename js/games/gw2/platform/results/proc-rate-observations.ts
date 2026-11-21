/** Counts proc rolls per random stream and projects the build's overridable and observed proc rates for Analysis. */
import { availableProcRateProfiles } from '#gw2/platform/builds/proc-rates.js';
import type { ProcReportObserver } from '#gw2/platform/combat/procs/registry.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import { gw2SigilIds } from '#gw2/platform/equipment/sigils/loadout.js';
import { SEVERANCE_PROC_RATE } from '#gw2/platform/equipment/sigils/severance.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
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
 * Outcomes decided by another roll, such as a hit's critical, arrive through outcome and count as rolls.
 */
export interface ProcRollObserver extends ProcReportObserver {
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

  // Random-source rolls and reported outcomes share one tally, so both kinds of proc read the same way.
  const record = (stream: string, probability: number, success: boolean): void => {
    // Match the source's clamp so expected counts use the chance that was actually rolled.
    const chance = clamp(probability || 0, 0, 1);
    const current = tally(stream || 'default');
    current.rolls += 1;
    current.successes += success ? 1 : 0;
    current.expectedSuccesses += chance;
    current.successVariance += chance * (1 - chance);
  };

  return {
    observe(random) {
      return Object.freeze({
        mode: random.mode,
        seed: random.seed,
        next: (stream?: string) => random.next(stream),
        roll(probability: number, stream = 'default'): boolean {
          const success = random.roll(probability, stream);
          record(stream, probability, success);
          return success;
        }
      });
    },
    cooldownBlocked(stream, opportunities) {
      tally(stream).cooldownBlocked += opportunities;
    },
    outcome: record,
    tallies: () => tallies
  };
}

/** One proc's chance beside what a single run observed. */
export interface Gw2ProcRateObservation {
  /** Override key shared with build assumptions, or an observed proc's reporting stream. */
  readonly id: string;
  readonly name: string;
  /** False when another roll, such as the hit's critical, decides the proc and no override applies. */
  readonly overridable: boolean;
  /**
   * Chance per eligible trigger: the override when set, otherwise the default. An observed proc reports the
   * mean chance its triggers rolled, or 0 without triggers.
   */
  readonly chance: number;
  /** Balance or sigil default, shown beside a custom chance for comparison; null for observed procs. */
  readonly defaultChance: number | null;
  readonly custom: boolean;
  /** What one eligible trigger is, worded as on the override control or the observed declaration. */
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

interface ProcRateDeclaration {
  readonly id: string;
  readonly name: string;
  /** Null marks an observed proc, whose chance comes from the rolls its owner reported. */
  readonly defaultChance: number | null;
  readonly opportunity: string;
}

/** Selected traits scope observed procs exactly as they scope override controls. */
function availableProcObservationProfiles(
  catalog: Pick<CanonicalCatalog, 'balanceProfilesById'>,
  selectedTraitIds: readonly SkillId[]
): BalanceProfile[] {
  const selected = new Set(selectedTraitIds.map(String));
  return [...catalog.balanceProfilesById.values()].filter(
    (profile) => profile.procObservation && selected.has(String(profile.procObservation.traitId))
  );
}

/**
 * Lists every overridable or observed proc the run could trigger, including procs with no triggers, so a
 * missing opportunity stays visible. A proc owns the stream named by its ID and any stream namespaced beneath it.
 */
export function projectProcRateObservations(ctx: ProcRateProjectionContext): Gw2ProcRateObservation[] {
  if (!ctx.procRollRecorder) return [];

  const overrides = ctx.config.procRateOverrides || {};
  const severanceEquipped = [1, 2].some((set) => gw2SigilIds(ctx.config, set).includes(SIGIL_IDS.SEVERANCE));
  const selectedTraitIds = [...ctx.traits];
  const declarations: ProcRateDeclaration[] = [
    ...availableProcRateProfiles(ctx.helpers, selectedTraitIds).map((profile) => ({
      id: profile.procRate!.id,
      name: profile.name,
      defaultChance: balanceProfileNumber(profile, profile.procRate!.field),
      opportunity: profile.procRate!.opportunity
    })),
    ...(severanceEquipped ? [SEVERANCE_PROC_RATE] : []),
    ...availableProcObservationProfiles(ctx.helpers, selectedTraitIds).map((profile) => ({
      id: profile.procObservation!.id,
      name: profile.name,
      defaultChance: null,
      opportunity: profile.procObservation!.opportunity
    }))
  ];
  const tallies = [...ctx.procRollRecorder.tallies()];

  return declarations.map((declaration) => {
    const owned = tallies.filter(([stream]) => stream === declaration.id || stream.startsWith(`${declaration.id}.`));
    const sum = (field: keyof ProcRollTally): number => owned.reduce((total, [, tally]) => total + tally[field], 0);
    const triggers = sum('rolls');
    const expectedProcs = sum('expectedSuccesses');
    const overridable = declaration.defaultChance !== null;
    const override = overridable ? overrides[declaration.id] : undefined;
    return {
      id: declaration.id,
      name: declaration.name,
      overridable,
      // Observed procs roll a different chance per trigger, so their row shows the mean.
      chance: override ?? declaration.defaultChance ?? (triggers ? expectedProcs / triggers : 0),
      defaultChance: declaration.defaultChance,
      custom: override !== undefined,
      opportunity: declaration.opportunity,
      triggers,
      procs: sum('successes'),
      expectedProcs,
      procVariance: sum('successVariance'),
      cooldownBlocked: sum('cooldownBlocked')
    };
  });
}
