import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { cappedResource } from '#gw2/platform/combat/resources/pool.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { cloneStateFields } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { necromancerSoulShardMaximum } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { soulBatteryCapacity } from '#gw2/professions/necromancer/core/traits/soul-reaping/resource-queries.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface NecromancerSelfCondition {
  readonly condition: string;
  readonly stacks: number;
  readonly appliedAt: number;
  readonly expiresAt: number;
}

export interface TasteForBloodGrant extends ChargeGrant {
  readonly at: number;
  /** Allied batches keep their registering cause, which parents the siphon each one pays for. */
  readonly cause?: Gw2ResolverEvent | null;
}

/** Preserve accepted cadence independently of action-tick-rounded queue deadlines. */
export interface NecromancerPassiveState extends PeriodicTaskState {
  deadline: number;
  interval: number;
}

export interface NecromancerCoreState {
  endurance: ResourceClock;
  /** Current and maximum life force are points; percentage mechanics convert against this capacity. */
  lifeForce: ResourceClock;
  /** Readiness reads the next actual passive wake without crediting a future grant. */
  signetPassives: Record<'undeath' | 'vampirism', NecromancerPassiveState>;
  /** Retain the admitted interval and unrounded anchor independently of action-tick delivery. */
  eternalLife: NecromancerPassiveState;
  activeShroud: string;
  activeShroudEntryId?: SkillId | null;
  activeShroudExitId?: SkillId | null;
  soulShardGrant: ChargeGrant;
  carapaceExpiries: number[];
  activeMinions: Record<string, number>;
  minionGenerations: Record<string, number>;
  minionAttackGenerations: Record<string, number>;
  /** Actual next attacks survive command pauses without reconstructing progress from elapsed time. */
  minionAttackCursors: Record<
    string,
    {
      cycleIndex: number;
      attackIndex: number;
      skillId: SkillId;
      activationId: string;
      started: boolean;
      busyUntil: number;
      /** Finite horrors retain summon-based expiry while their attack waits for engagement. */
      expiresAt?: number;
    }
  >;
  /** Expiry timestamps for armed flip skills; persistent exits and minion commands use Infinity. */
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  /** Each sword continuation replaces its prior expiry owner. */
  swordChainGeneration: number;
  selfConditions: NecromancerSelfCondition[];
  plagueSendingArmed: boolean;
  lichEndsAt: number;
  /** Re-entering the timed form owns a new cancellable expiry. */
  lichGeneration: number;

  tasteForBloodGrants: Record<string, TasteForBloodGrant[]>;
}

const NECROMANCER_BASE_HEALTH = 9212;

/** Maximum life-force points use build vitality and Soul Battery, independently of current player health. */
export function necromancerLifeForceCapacity(
  config: NecromancerConfig,
  balanceContext: unknown,
  vitality: number
): number {
  const capacityMultiplier = soulBatteryCapacity(config, balanceContext);

  // A live resource pool must have positive capacity.
  if (capacityMultiplier <= 0) throw new RangeError('Life-force capacity multiplier must be positive.');

  return (NECROMANCER_BASE_HEALTH + Math.max(0, vitality) * 10) * 0.69 * capacityMultiplier;
}

/** Detach only public fields before clamping resources so normalization cannot mutate live owners. */
export function projectNecromancerPlanningState(input: Gw2PlanningStateInput) {
  const state = cloneStateFields((input.profession as { core: NecromancerCoreState }).core, [
    'endurance',
    'lifeForce',
    'activeShroud',
    'soulShardGrant',
    'carapaceExpiries',
    'activeMinions',
    'availableFlips',
    'autoattackChains',
    'selfConditions'
  ]);
  state.lifeForce.value = cappedResource(state.lifeForce.value, state.lifeForce.maximum);
  // Detached resource values obey the same selected capacity as live grants.
  state.soulShardGrant.charges = cappedResource(state.soulShardGrant.charges, necromancerSoulShardMaximum(input));
  return {
    [STATE.AUTOATTACK_CHAINS]: state.autoattackChains,
    [STATE.ENDURANCE]: state.endurance,
    [STATE.LIFE_FORCE]: state.lifeForce,
    [STATE.AVAILABLE_FLIPS]: state.availableFlips,
    [STATE.ACTIVE_SHROUD]: state.activeShroud,
    [STATE.SOUL_SHARD_GRANT]: state.soulShardGrant,
    [STATE.CARAPACE_EXPIRIES]: state.carapaceExpiries,
    [STATE.ACTIVE_MINIONS]: state.activeMinions,
    [STATE.SELF_CONDITIONS]: state.selfConditions
  };
}
