import type { Gw2ResolvedStats } from '#gw2/platform/attributes/stats.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import { reviseEffectState } from '#gw2/platform/combat/effect-state.js';
import type { EffectRecipient } from '#gw2/platform/combat/query/effect-stacks.js';
import { liveBoonSnapshot } from '#gw2/platform/combat/query/effect-stacks.js';
import { activeBoonStacks, activeBuffStacks, targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import type { CompanionEffects } from '#gw2/platform/combat/state/companion.js';
import { remainingTargetHealthBelow, remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import { conditionApplicationExpiry } from '#gw2/platform/combat/state/targets.js';
import type { ComboFieldEvent } from '#gw2/platform/combos/types.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2SimulationDiagnostic } from '#gw2/platform/results/diagnostics.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** Query views observe accepted combat facts without granting mutation. */
export interface MechanicCombatQueries {
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
  registerCompanion(companionId: string, effects: CompanionEffects): void;
  retireCompanion(companionId: string, removedAt: number): void;
  fieldFor(skillId: SkillId, at: number | undefined): Readonly<ComboFieldEvent> | undefined;
  expireField(fieldId: string, at: number): void;
  allocateEffectActivation(prefix: string): string;
  warn(diagnostic: Gw2SimulationDiagnostic): void;
}

/** Mechanics request shared-state changes at their existing phase; resolver stores never leave their owner. */
export function createMechanicCombatServices(runtime: Gw2ResolverRuntime): MechanicCombatServices {
  const operations = {
    registerCompanion(companionId: string, effects: CompanionEffects): void {
      runtime.companions.set(companionId, effects);
    },
    companionRetiredAt: (companionId: string): number | undefined => runtime.retiredCompanions.get(companionId),
    activeBoonStacks: (kind: string, at: number, maximum = 25, recipient: EffectRecipient = { actor: ACTOR.PLAYER }) =>
      activeBoonStacks({ config: runtime.config, runtime, time: at }, kind, maximum, recipient),
    activeBuffStacks: (kind: string, at: number, maximum = 25, recipient: EffectRecipient = { actor: ACTOR.PLAYER }) =>
      activeBuffStacks({ runtime, time: at }, kind, maximum, recipient),
    buffApplications: (kind: string): readonly Readonly<Gw2TimedBuffApplication>[] => runtime.buffs.get(kind) ?? [],
    targetHasCondition: (condition: string, at: number) => runtime.query.targetHasCondition(condition, at, runtime),
    targetConditionStacks: (condition: string, at: number) =>
      runtime.query.targetConditionStacks(condition, at, runtime),
    targetHealthBelow: (threshold: number) => remainingTargetHealthBelow(runtime.config, runtime, threshold),
    remainingTargetHealthFraction: () => remainingTargetHealthFraction(runtime.config, runtime),
    // Full large-golem overlap requires at least its measured 700-unit diameter.
    // Encounter metadata always wins over the editable Golem assumption.
    targetHitboxSize: (): 'small' | 'large' =>
      runtime.encounter
        ? runtime.encounter.hitboxWidth >= 700
          ? 'large'
          : 'small'
        : runtime.config.professionAssumptions?.hitboxSize === 'large'
          ? 'large'
          : 'small',
    targetConditionCount: (at: number) =>
      targetConditionCount({ config: runtime.config, query: runtime.query, runtime, time: at }),
    statsAt: (at: number, event: Gw2ResolverEvent) => runtime.query.statsAt(at, event, runtime),
    conditionDurationMultiplier: (condition: string, at: number, stats: Gw2ResolvedStats, event: Gw2ResolverEvent) =>
      runtime.query.conditionDurationMultiplier(condition, at, stats, event, runtime),
    boonApplications: (kind: string): readonly Readonly<Gw2TimedBuffApplication>[] => runtime.boons.get(kind) ?? [],
    boonSnapshot: (kind: string, at: number, recipient: EffectRecipient) =>
      recipient.actor === 'companion' &&
      recipient.companionId &&
      at >= (runtime.retiredCompanions.get(recipient.companionId) ?? Infinity)
        ? { stacks: 0, duration: 0 }
        : liveBoonSnapshot(
            (recipient.actor === 'companion'
              ? runtime.companions.get(recipient.companionId ?? '')?.boons
              : runtime.boons
            )?.get(kind) ?? [],
            runtime.config,
            kind,
            at,
            recipient
          ),
    reviseBuffExpiry(
      kind: string,
      select: (application: Readonly<Gw2TimedBuffApplication>) => boolean,
      expiry: (at: number) => number
    ): void {
      // Live recipient stores and reporting history receive the same explicit consumption.
      for (const buffs of [runtime.buffs, ...[...runtime.companions.values()].map((effects) => effects.buffs)]) {
        const applications = buffs.get(kind);

        if (applications)
          buffs.set(
            kind,
            applications.map((application) =>
              select(application) ? { ...application, expiresAt: expiry(application.expiresAt) } : application
            )
          );
      }
    },
    retireCompanion(companionId: string, removedAt: number): void {
      // Retire the entity, not its shared grants to other recipients or ranger-owned damage.
      if (runtime.retiredCompanions.has(companionId)) return;

      runtime.retiredCompanions.set(companionId, removedAt);
      const effects = runtime.companions.get(companionId);
      effects?.boons.clear();
      effects?.buffs.clear();
      runtime.companions.delete(companionId);
      // End future payouts and live stacks without rolling back damage already settled.
      for (const condition of runtime.conditionState.values())
        for (const application of condition.stacks) {
          if (
            !application.independentConditionOwner ||
            application.actorType !== ACTOR.SUMMON ||
            application.summonOwner !== companionId
          )
            continue;

          // Even naturally expired stacks can have unpaid buffered damage, which removal cancels.
          const shortened = conditionApplicationExpiry(application) > removedAt;
          application.removedAt = Math.min(application.removedAt ?? Infinity, removedAt);

          // Invalidate cached windows only when retirement shortens the accepted lifetime.
          if (shortened) reviseEffectState(condition);
        }
    },
    fieldFor: (skillId: SkillId, at: number | undefined): Readonly<ComboFieldEvent> | undefined =>
      [...runtime.combo.fields.values()].find((field) => field.skillId === skillId && field.at === at),
    expireField(fieldId: string, at: number): void {
      const field = runtime.combo.fields.get(fieldId);

      if (field) runtime.combo.fields.set(fieldId, { ...field, expiresAt: at });
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
    activeBoonStacks: operations.activeBoonStacks,
    boonApplications: operations.boonApplications,
    buffApplications: operations.buffApplications,
    activeBuffStacks: operations.activeBuffStacks,
    boonSnapshot: operations.boonSnapshot,
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
