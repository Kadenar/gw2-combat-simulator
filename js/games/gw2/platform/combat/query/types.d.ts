/** Owns the combat/query/types.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { SchedulerRecord, SimulationEvent } from '#gw2/platform/engine/types.js';
import type {
  Gw2BuffAudience,
  Gw2RuntimeStateLike,
  Gw2TimedBuffApplication
} from '#gw2/platform/combat/state/types.js';
import type { Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import type { Gw2SigilSet } from '#gw2/platform/equipment/types.js';

export interface Gw2QueryRuntime extends Gw2RuntimeStateLike {
  readonly boons?: Map<string, Gw2TimedBuffApplication[]>;
  readonly activeWeaponSet?: number;
  readonly sigil?: { readonly severanceUntil?: number };
  readonly relic?: Gw2RelicRuntime;
  readonly profession?: object | null;
}

export interface Gw2CriticalChanceContributor {
  readonly id: string;
  readonly label: string;
  readonly amount: number;
}

export interface Gw2CriticalResult {
  chance: number;
  damage: number;
  didCrit?: boolean | null;
  readonly chanceBeforeCap?: number;
  readonly contributors?: readonly Gw2CriticalChanceContributor[];
}

export interface Gw2CombatQuery {
  statsAt(time: number, event?: SimulationEvent | null, runtime?: Gw2QueryRuntime | null): Gw2ResolvedStats;
  mightStacksAt(time: number, runtime?: Gw2QueryRuntime | null, event?: SimulationEvent | null): number;
  furyActiveAt(time: number, runtime?: Gw2QueryRuntime | null, event?: SimulationEvent | null): boolean;
  vulnerabilityStacksAt(time: number, runtime?: Gw2QueryRuntime | null): number;
  critical(event: SimulationEvent, time: number, runtime?: Gw2QueryRuntime | null): Gw2CriticalResult;
  strikeMultiplier(event: SimulationEvent, time: number, runtime?: Gw2QueryRuntime | null): number;
  conditionMultiplier(
    name: string,
    time: number,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null
  ): number;
  conditionDurationMultiplier(
    name: string,
    time: number,
    stats?: Gw2ResolvedStats,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null
  ): number;
  conditionBaseDurationMultiplier(
    name: string,
    time: number,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null
  ): number;
  targetConditionStacks(condition: string, time: number, runtime?: Gw2QueryRuntime | null): number;
  targetHasCondition(condition: string, time: number, runtime?: Gw2QueryRuntime | null): boolean;
  readonly activeWeaponSetAt: Gw2TimelineIndex['activeWeaponSetAt'];
  readonly activeSigilSetAt: Gw2TimelineIndex['activeSigilSetAt'];
  readonly timedStacks: Gw2TimelineIndex['timedStacks'];
  readonly timeline: Readonly<Gw2TimelineIndex>;
}

export interface Gw2ResolvedStats extends SchedulerRecord {
  readonly power: number;
  readonly precision: number;
  readonly toughness: number;
  readonly vitality: number;
  readonly ferocity: number;
  readonly conditionDamage: number;
  readonly expertise: number;
  readonly concentration: number;
  readonly healingPower: number;
  readonly boonDurationBonus: number;
  readonly boonDurationBonuses: Readonly<Record<string, number>>;
  readonly conditionDurationBonus: number;
  readonly conditionDurationBonuses: Readonly<Record<string, number>>;
}

export interface Gw2TimelineIndex {
  buffStacksAt(
    kind: string,
    time: number,
    duration: number,
    maximum: number,
    audience?: Gw2BuffAudience,
    companionId?: string | null
  ): number;
  timedStacks(kind: string, time: number, duration: number, maximum: number): number;
  timedActive(kind: string, time: number): boolean;
  vigorActiveAt(time: number): boolean;
  activeWeaponSetAt(time: number): number;
  activeSigilSetAt(time: number): Gw2SigilSet;
  skillOnCooldownAt(skillId: import('#gw2/platform/engine/types.js').SkillId, time: number): boolean;
}
