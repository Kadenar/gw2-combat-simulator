import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  applyEngineerDerivedCondition,
  queueDamage
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { applyAimAssistedRocket } from '#gw2/professions/engineer/core/traits/explosives.js';
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerSchedulerContext,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';

/** Emits kit transitions as sigil swaps so shared equipment reactions observe the bar change. */
export function emitEngineerBarSwap(context: EngineerSchedulerContext, skill: EngineerSkill, at: number): void {
  context.emit({
    type: 'sigil_swap',
    at,
    source: 'engineer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet
  });
}

/** Air Blast's Burning missile exists only against a target still burning at impact; knockback resolves separately. */
export function handleAirBlast(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (!context.query.targetHasCondition('Burning', event.at, context)) return;
  // Materialize the deferred missile without importing unrelated proc or strike state from its trigger.
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      priority: event.priority,
      source: event.source,
      sourceId: event.sourceId,
      actorType: event.actorType,
      ownerActorType: event.ownerActorType,
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Air Blast — Burning',
      activationId: event.activationId,
      condition: String(event.condition),
      stacks: Number(event.stacks),
      duration: Number(event.duration),
      projectile: true,
      applicationIndex: event.applicationIndex,
      totalApplications: event.totalApplications
    })
  );
  applyAimAssistedRocket(context, event);
}

// Focused is the shared spear target window established by Conduit Surge.
function focused(context: EngineerResolverContext, at: number): boolean {
  return Number(professionCoreState(context).focusedUntil || 0) > at;
}

/** Each Lightning Rod pulse applies Vulnerability, with stronger strikes and stacks against Focused targets. */
export function handleLightningRodPulse(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const isFocused = focused(context, event.at);
  const profile = requireBalanceProfileFromContext(
    context,
    isFocused ? PROFILE.focusedLightningRod : PROFILE.lightningRod
  );
  const idProfile = requireBalanceProfileFromContext(context, profile.id);
  const condition = requireEffect(idProfile, 'condition', 'Vulnerability');
  const strike = requireEffect(idProfile, 'strike', profile.name);
  if (strike)
    queueDamage(context, event, {
      name: 'Lightning Rod',
      coefficient: Number(strike.coefficient)
    });
  if (condition)
    applyEngineerDerivedCondition(context, event, {
      name: 'Lightning Rod',
      condition: String(condition.condition),
      stacks: Number(condition.stacks),
      duration: Number(condition.duration)
    });
}

/** Opens the Focused target window and resolves Conduit Surge's strike and burning packets. */
export function handleConduitSurge(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, PROFILE.conduitSurge);
  const idProfile = requireBalanceProfileFromContext(context, profile.id);
  const burning = requireEffect(idProfile, 'condition', 'Burning');
  // Math.max preserves a longer existing Focused window; Conduit Surge must not shorten it
  professionCoreState(context).focusedUntil = Math.max(
    Number(professionCoreState(context).focusedUntil || 0),
    event.at + balanceProfileNumber(idProfile, 'durationMultiplier')
  );
  const strike = requireEffect(idProfile, 'strike', profile.name);
  if (strike)
    queueDamage(context, event, {
      name: 'Conduit Surge',
      coefficient: Number(strike.coefficient)
    });
  if (burning)
    context.queue.enqueue(
      buildResolverCondition({
        at: event.at,
        name: 'Conduit Surge — Burning',
        skillName: 'Conduit Surge',
        condition: String(burning.condition),
        stacks: Number(burning.stacks),
        duration: Number(burning.duration),
        source: 'engineer',
        sourceId: event.skillId ?? event.sourceId,
        actorType: 'player'
      })
    );
}

/** Resolves Electric Artillery using its stored charges and current Focused state. */
export function handleElectricArtillery(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const isFocused = focused(context, event.at);
  const profile = requireBalanceProfileFromContext(
    context,
    isFocused ? PROFILE.focusedElectricArtillery : PROFILE.electricArtillery
  );
  const idProfile = requireBalanceProfileFromContext(context, profile.id);
  const immobilize = requireEffect(idProfile, 'condition', 'Immobilized');
  const vulnerability = requireEffect(idProfile, 'condition', 'Vulnerability');
  const burning = requireEffect(idProfile, 'condition', 'Burning');
  // charges accumulate from Lightning Rod hits (max 12); Math.trunc discards partial charges
  const charges = boundedInteger(event.charges || 0, 0, 0, balanceProfileNumber(idProfile, 'maximumStacks'));
  const strike = requireEffect(idProfile, 'strike', profile.name);
  if (strike)
    queueDamage(context, event, {
      name: 'Electric Artillery',
      coefficient: Number(strike.coefficient),
      explosion: true
    });
  if (immobilize)
    applyEngineerDerivedCondition(context, event, {
      name: 'Electric Artillery',
      condition: String(immobilize.condition),
      stacks: Number(immobilize.stacks),
      duration: Number(immobilize.duration)
    });
  // The tooltip specifies charges required per stack: one when Focused, otherwise two.
  if (vulnerability) {
    const vulnerabilityStacks =
      Math.floor(charges / balanceProfileNumber(idProfile, 'chargesPerVulnerability')) * Number(vulnerability.stacks);
    if (vulnerabilityStacks > 0) {
      applyEngineerDerivedCondition(context, event, {
        name: 'Electric Artillery',
        condition: String(vulnerability.condition),
        stacks: vulnerabilityStacks,
        duration: Number(vulnerability.duration),
        // Artillery's Vulnerability does not scale with condition duration.
        metadata: { fixedDuration: true }
      });
    }
  }

  // Separate Burning applications preserve the total, including any fractional final stack.
  if (burning) {
    const stacks = Number(burning.stacks);
    for (let index = 0; index < Math.ceil(stacks); index += 1) {
      context.queue.enqueue(
        buildResolverCondition({
          at: event.at,
          name: 'Electric Artillery — Burning',
          skillName: 'Electric Artillery',
          condition: 'Burning',
          stacks: Math.min(1, stacks - index),
          duration: Number(burning.duration) + charges * balanceProfileNumber(idProfile, 'burningDurationPerCharge'),
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: 'player'
        })
      );
    }
  }
}
