/** Coordinates mechanic requests while each combat module handles its own state changes. */
import type { Gw2ResolvedStats } from '#gw2/platform/attributes/stats.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import type { LiveEffects } from '#gw2/platform/combat/live-effects.js';
import type { EffectRecipient } from '#gw2/platform/combat/query/effect-stacks.js';
import { activeBoonStacks, activeBuffStacks, targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { remainingTargetHealthBelow, remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import { hitboxSizeForWidth } from '#gw2/platform/combat/state/targets.js';
import type { Gw2ComboController } from '#gw2/platform/combos/resolution.js';
import type { ComboFieldEvent } from '#gw2/platform/combos/types.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2SimulationDiagnostic } from '#gw2/platform/results/diagnostics.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** Query views observe accepted combat facts without granting mutation. */
export interface MechanicCombatQueries {
  /** Detached observations retain the combo controller's eligibility rules without exposing its field storage. */
  activeComboFields(ownerId: string, at: number): readonly Readonly<ComboFieldEvent>[];
  activeBoonStacks(kind: string, at: number, maximum?: number, recipient?: EffectRecipient): number;
  activeBuffStacks(kind: string, at: number, maximum?: number, recipient?: EffectRecipient): number;
  buffApplications(kind: string): readonly Readonly<Gw2TimedBuffApplication>[];
  targetHasCondition(condition: string, at: number): boolean;
  targetConditionStacks(condition: string, at: number): number;
  targetHealthBelow(threshold: number): boolean;
  targetHitboxSize(): 'small' | 'large';
  /** Null when target health is unbounded. */
  remainingTargetHealthFraction(): number | null;
  targetConditionCount(at: number): number;
  statsAt(at: number, event: Gw2ResolverEvent): Gw2ResolvedStats;
  conditionDurationMultiplier(condition: string, at: number, stats: Gw2ResolvedStats, event: Gw2ResolverEvent): number;
  boonApplications(kind: string): readonly Readonly<Gw2TimedBuffApplication>[];
  /** Remaining accepted duration, without configured boon assumptions. */
  boonDuration(kind: string, at: number, recipient?: EffectRecipient): number;
  /** A boon copy reads executed applications; a retired companion has no live boons to copy. */
  boonSnapshot(
    kind: string,
    at: number,
    recipient: EffectRecipient
  ): { readonly stacks: number; readonly duration: number };
}

/** Mechanics use named combat queries and revisions; the engine retains ownership of timeline replay. */
export interface MechanicCombatServices extends MechanicCombatQueries {
  readonly queries: MechanicCombatQueries;
  companionRetiredAt(companionId: string): number | undefined;
  reviseBuffExpiry(
    kind: string,
    select: (application: Readonly<Gw2TimedBuffApplication>) => boolean,
    expiry: (at: number) => number
  ): void;
  retireCompanion(companionId: string, removedAt: number): void;
  fieldFor(skillId: SkillId, at: number | undefined): Readonly<ComboFieldEvent> | undefined;
  expireField(fieldId: string, at: number): void;
  allocateEffectActivation(prefix: string): string;
  warn(diagnostic: Gw2SimulationDiagnostic): void;
}

/** Mechanics request shared-state changes at their existing phase; resolver stores never leave their owner. */
export function createMechanicCombatServices(
  runtime: Gw2ResolverRuntime,
  conditions: Pick<Gw2ConditionResolution, 'retireCompanionConditions'>,
  commands: {
    readonly liveEffects: Pick<LiveEffects, 'reviseBuffExpiry' | 'retireCompanion'>;
    readonly combo: Pick<Gw2ComboController, 'expireField'>;
  }
): MechanicCombatServices {
  const operations = {
    companionRetiredAt: runtime.liveEffects.queries.companionRetiredAt,
    activeBoonStacks: (kind: string, at: number, maximum = 25, recipient: EffectRecipient = { actor: ACTOR.PLAYER }) =>
      activeBoonStacks({ config: runtime.config, runtime, time: at }, kind, maximum, recipient),
    activeBuffStacks: (kind: string, at: number, maximum = 25, recipient: EffectRecipient = { actor: ACTOR.PLAYER }) =>
      activeBuffStacks({ runtime, time: at }, kind, maximum, recipient),
    activeComboFields: (ownerId: string, at: number): readonly Readonly<ComboFieldEvent>[] =>
      runtime.combo.activeFields(ownerId, at),
    buffApplications: (kind: string): readonly Readonly<Gw2TimedBuffApplication>[] =>
      runtime.liveEffects.queries.buffApplications(kind),
    targetHasCondition: (condition: string, at: number) => runtime.query.targetHasCondition(condition, at, runtime),
    targetConditionStacks: (condition: string, at: number) =>
      runtime.query.targetConditionStacks(condition, at, runtime),
    targetHealthBelow: (threshold: number) => remainingTargetHealthBelow(runtime.config, runtime, threshold),
    remainingTargetHealthFraction: () => remainingTargetHealthFraction(runtime.config, runtime),
    // Encounter metadata always wins over the editable Golem assumption.
    targetHitboxSize: (): 'small' | 'large' =>
      runtime.encounter
        ? hitboxSizeForWidth(runtime.encounter.hitboxWidth)
        : runtime.config.professionAssumptions?.hitboxSize === 'large'
          ? 'large'
          : 'small',
    targetConditionCount: (at: number) =>
      targetConditionCount({ config: runtime.config, query: runtime.query, runtime, time: at }),
    statsAt: (at: number, event: Gw2ResolverEvent) => runtime.query.statsAt(at, event, runtime),
    conditionDurationMultiplier: (condition: string, at: number, stats: Gw2ResolvedStats, event: Gw2ResolverEvent) =>
      runtime.query.conditionDurationMultiplier(condition, at, stats, event, runtime),
    boonApplications: (kind: string): readonly Readonly<Gw2TimedBuffApplication>[] =>
      runtime.liveEffects.queries.boonApplications(kind),
    boonSnapshot: runtime.liveEffects.queries.boonSnapshot,
    boonDuration: runtime.liveEffects.queries.boonDuration,
    reviseBuffExpiry: commands.liveEffects.reviseBuffExpiry,
    retireCompanion(companionId: string, removedAt: number): void {
      // Retire condition ownership once, after the live recipient's boons and buffs are disposed.
      if (commands.liveEffects.retireCompanion(companionId, removedAt))
        conditions.retireCompanionConditions(companionId, removedAt);
    },
    fieldFor: (skillId: SkillId, at: number | undefined): Readonly<ComboFieldEvent> | undefined =>
      runtime.combo.fieldFor(skillId, at),
    expireField(fieldId: string, at: number): void {
      commands.combo.expireField(fieldId, at);
    },
    allocateEffectActivation(prefix: string): string {
      return prefix + ++runtime.weaponStrengthActivationOrder;
    },
    warn(diagnostic: Gw2SimulationDiagnostic): void {
      runtime.warnings.push(diagnostic);
    }
  };
  // Owner-selected observations expose no resolver mutation or aggregate service reference.
  const queries = Object.freeze({
    activeComboFields: operations.activeComboFields,
    activeBoonStacks: operations.activeBoonStacks,
    boonApplications: operations.boonApplications,
    buffApplications: operations.buffApplications,
    activeBuffStacks: operations.activeBuffStacks,
    boonSnapshot: operations.boonSnapshot,
    boonDuration: operations.boonDuration,
    targetHasCondition: operations.targetHasCondition,
    targetConditionStacks: operations.targetConditionStacks,
    targetConditionCount: operations.targetConditionCount,
    targetHealthBelow: operations.targetHealthBelow,
    targetHitboxSize: operations.targetHitboxSize,
    remainingTargetHealthFraction: operations.remainingTargetHealthFraction,
    statsAt: operations.statsAt,
    conditionDurationMultiplier: operations.conditionDurationMultiplier
  } satisfies MechanicCombatQueries);
  return Object.freeze({ ...operations, queries });
}
