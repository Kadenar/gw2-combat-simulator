import { reviseEffectState } from '#gw2/platform/combat/effect-state.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { activeBoonStacks, activeBuffStacks, targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import type { EffectRecipient } from '#gw2/platform/combat/query/effect-stacks.js';
import { liveBoonSnapshot } from '#gw2/platform/combat/query/effect-stacks.js';
import {
  targetHealthLoss,
  remainingTargetHealthFraction,
  remainingTargetHealthBelow
} from '#gw2/platform/combat/state/target-health.js';
import type { Gw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import type { ComboFieldEvent } from '#gw2/platform/combos/types.js';

/** Combat capabilities granted to mechanics: shared-state queries plus phase-preserving mutation requests. */
export interface MechanicCombatServices {
  companionRetiredAt(companionId: string): number | undefined;
  activeBoonStacks(kind: string, at: number, maximum?: number, recipient?: EffectRecipient): number;
  activeBuffStacks(kind: string, at: number, maximum?: number, recipient?: EffectRecipient): number;
  buffApplications(kind: string): readonly Readonly<Gw2TimedBuffApplication>[];
  targetHasCondition(condition: string, at: number): boolean;
  targetConditionStacks(condition: string, at: number): number;
  targetHealthLoss(): number;
  targetHealthBelow(threshold: number): boolean;
  /** Null when target health is unbounded. */
  remainingTargetHealthFraction(): number | null;
  targetConditionCount(at: number): number;
  statsAt(at: number, event: Gw2ResolverEvent): Gw2ResolvedStats;
  conditionDurationMultiplier(condition: string, at: number, stats: Gw2ResolvedStats, event: Gw2ResolverEvent): number;
  readonly timeline: Readonly<Gw2TimelineIndex>;
  boonApplications(kind: string): readonly Readonly<Gw2TimedBuffApplication>[];
  /** A boon copy reads executed applications; a retired companion has no live boons to copy. */
  boonSnapshot(
    kind: string,
    at: number,
    recipient: EffectRecipient
  ): { readonly stacks: number; readonly duration: number };
  reviseBuffExpiry(
    kind: string,
    select: (application: Readonly<Gw2TimedBuffApplication>) => boolean,
    expiry: (at: number) => number
  ): void;
  retireCompanion(companionId: string, removedAt: number): void;
  fieldFor(skillId: SkillId, at: number | undefined): Readonly<ComboFieldEvent> | undefined;
  expireField(fieldId: string, at: number): void;
  allocateEffectActivation(prefix: string): string;
  warn(message: string): void;
  react(
    ...args: Parameters<Gw2ResolverRuntime['dispatchReaction']>
  ): ReturnType<Gw2ResolverRuntime['dispatchReaction']>;
}

/** Mechanics request shared-state changes at their existing phase; resolver stores never leave their owner. */
export function createMechanicCombatServices(runtime: Gw2ResolverRuntime): MechanicCombatServices {
  return Object.freeze({
    companionRetiredAt: (companionId: string): number | undefined => runtime.retiredCompanions.get(companionId),
    activeBoonStacks: (kind: string, at: number, maximum = 25, recipient: EffectRecipient = { actor: 'player' }) =>
      activeBoonStacks({ config: runtime.config, runtime, time: at }, kind, maximum, recipient),
    activeBuffStacks: (kind: string, at: number, maximum = 25, recipient: EffectRecipient = { actor: 'player' }) =>
      activeBuffStacks({ runtime, time: at }, kind, maximum, recipient),
    buffApplications: (kind: string): readonly Readonly<Gw2TimedBuffApplication>[] => runtime.buffs.get(kind) ?? [],
    targetHasCondition: (condition: string, at: number) => runtime.query.targetHasCondition(condition, at, runtime),
    targetConditionStacks: (condition: string, at: number) =>
      runtime.query.targetConditionStacks(condition, at, runtime),
    targetHealthLoss: () => targetHealthLoss(runtime.config, runtime),
    targetHealthBelow: (threshold: number) => remainingTargetHealthBelow(runtime.config, runtime, threshold),
    remainingTargetHealthFraction: () => remainingTargetHealthFraction(runtime.config, runtime),
    targetConditionCount: (at: number) =>
      targetConditionCount({ config: runtime.config, query: runtime.query, runtime, time: at }),
    statsAt: (at: number, event: Gw2ResolverEvent) => runtime.query.statsAt(at, event, runtime),
    conditionDurationMultiplier: (condition: string, at: number, stats: Gw2ResolvedStats, event: Gw2ResolverEvent) =>
      runtime.query.conditionDurationMultiplier(condition, at, stats, event, runtime),
    get timeline() {
      return runtime.query.timeline;
    },
    boonApplications: (kind: string): readonly Readonly<Gw2TimedBuffApplication>[] => runtime.boons.get(kind) ?? [],
    boonSnapshot: (kind: string, at: number, recipient: EffectRecipient) =>
      recipient.actor === 'companion' &&
      recipient.companionId &&
      at >= (runtime.retiredCompanions.get(recipient.companionId) ?? Infinity)
        ? { stacks: 0, duration: 0 }
        : liveBoonSnapshot(runtime.boons.get(kind) ?? [], runtime.config, kind, at, recipient),
    reviseBuffExpiry(
      kind: string,
      select: (application: Readonly<Gw2TimedBuffApplication>) => boolean,
      expiry: (at: number) => number
    ): void {
      const applications = runtime.buffs.get(kind);
      if (applications)
        runtime.buffs.set(
          kind,
          applications.map((application) =>
            select(application) ? { ...application, expiresAt: expiry(application.expiresAt) } : application
          )
        );
    },
    retireCompanion(companionId: string, removedAt: number): void {
      // Retire the entity, not its shared grants to other recipients or ranger-owned damage.
      if (runtime.retiredCompanions.has(companionId)) return;
      runtime.retiredCompanions.set(companionId, removedAt);
      // End future payouts and live stacks without rolling back damage already settled.
      for (const condition of runtime.conditionState.values())
        for (const stack of condition.stacks) {
          const application = stack.application;
          if (
            !application.independentConditionOwner ||
            application.actorType !== 'summon' ||
            application.summonOwner !== companionId
          )
            continue;
          // Even naturally expired stacks can have unpaid buffered damage, which removal cancels.
          application.removedAt = Math.min(application.removedAt ?? Infinity, removedAt);
          if (stack.expiresAt > removedAt) {
            stack.expiresAt = removedAt;
            reviseEffectState(condition);
          }
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
    warn(message: string): void {
      runtime.warnings.push(message);
    },
    react: (...args: Parameters<Gw2ResolverRuntime['dispatchReaction']>) => runtime.dispatchReaction(...args)
  });
}
