import { reviseEffectState } from '#gw2/platform/combat/effect-revisions.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { activeBoonStacks, activeBuffStacks, targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import type { EffectRecipient } from '#gw2/platform/combat/query/effect-query.js';
import { liveBoonSnapshot } from '#gw2/platform/combat/query/live-boon-snapshot.js';
import {
  targetHealthLoss,
  remainingTargetHealthFraction,
  remainingTargetHealthBelow
} from '#gw2/platform/combat/state/target-health.js';

/** Mechanics request shared-state changes at their existing phase; resolver stores never leave their owner. */
export function createMechanicCombatServices(runtime: Gw2ResolverRuntime) {
  return Object.freeze({
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
      liveBoonSnapshot(runtime.boons.get(kind) ?? [], runtime.config, kind, at, recipient),
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
    retireCompanionConditions(source: string, companionId: string, removedAt: number): void {
      // Cancellation and live stack visibility are distinct; natural expiry ticks retain their existing treatment.
      for (const condition of runtime.conditionState.values())
        for (const stack of condition.stacks) {
          const application = stack.application;
          if (
            application.source !== source ||
            (application.summonOwner && String(application.summonOwner) !== companionId)
          )
            continue;
          if (application.naturalExpiresAt > removedAt) application.removedAt = removedAt;
          if (stack.expiresAt > removedAt) {
            stack.expiresAt = removedAt;
            reviseEffectState(condition);
          }
        }
    },
    fieldFor: (
      skillId: SkillId,
      at: number | undefined
    ): Readonly<NonNullable<ReturnType<typeof runtime.combo.fields.get>>> | undefined =>
      [...runtime.combo.fields.values()].find((field) => field.skillId === skillId && field.at === at),
    expireField(fieldId: string, at: number): void {
      const field = runtime.combo.fields.get(fieldId);
      if (field) runtime.combo.fields.set(fieldId, { ...field, expiresAt: at });
    },
    recordObservation(event: Gw2ResolverEvent): void {
      if (runtime.reporting) runtime.resolved.push(event);
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
