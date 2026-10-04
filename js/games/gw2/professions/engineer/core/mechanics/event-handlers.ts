import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { addTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  buildEngineerCondition,
  buildEngineerStrike
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerRuntime,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';

/** Builds kit transitions as sigil swaps so shared equipment reactions observe the bar change. */
export function emitEngineerBarSwap(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'sigil_swap',
      at,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      weaponSet: context.activeWeaponSet
    }
  });
}

// Focused is the shared spear target window established by Conduit Surge.
function focused(context: EngineerResolverContext, at: number): boolean {
  return (professionCoreState(context).focusedUntil || 0) > at;
}

/** Each Lightning Rod pulse applies Vulnerability, with stronger strikes and stacks against Focused targets. */
export function handleLightningRodPulse(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only a target-facing pulse in combat can earn an Artillery charge.
  if (
    !event.offTarget &&
    !context.combatStartPending &&
    (context.combatStartTime == null || event.at >= context.combatStartTime)
  ) {
    const state = context.profession.core;
    state.lightningRodChargeExpiries = addTimedStacks(state.lightningRodChargeExpiries, 1, event.at, 12, 12).expiries;
  }

  const isFocused = focused(context, event.at);
  const profile = requireBalanceProfileFromContext(
    context,
    isFocused ? PROFILE.focusedLightningRod : PROFILE.lightningRod
  );
  const idProfile = requireBalanceProfileFromContext(context, profile.id);
  const condition = requireEffect(idProfile, 'condition', 'Vulnerability');
  const strike = requireEffect(idProfile, 'strike', profile.name);
  if (strike)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        name: 'Lightning Rod',
        coefficient: Number(strike.coefficient)
      })
    });
  if (condition)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Lightning Rod',
        condition: String(condition.condition),
        stacks: Number(condition.stacks),
        duration: Number(condition.duration)
      }),
      settlement: 'reaction'
    });
}

/** Opens the Focused target window and resolves Conduit Surge's strike and burning packets. */
export function handleConduitSurge(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, PROFILE.conduitSurge);
  const idProfile = requireBalanceProfileFromContext(context, profile.id);
  const burning = requireEffect(idProfile, 'condition', 'Burning');
  // Math.max preserves a longer existing Focused window; Conduit Surge must not shorten it
  if (
    !event.offTarget &&
    !context.combatStartPending &&
    (context.combatStartTime == null || event.at >= context.combatStartTime)
  )
    professionCoreState(context).focusedUntil = Math.max(
      professionCoreState(context).focusedUntil || 0,
      event.at + balanceProfileNumber(idProfile, 'durationMultiplier')
    );
  const strike = requireEffect(idProfile, 'strike', profile.name);
  if (strike)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        name: 'Conduit Surge',
        coefficient: Number(strike.coefficient),
        // Attempt the leap only when the strike reaches impact.
        comboFinisher: {
          ownerId: 'engineer',
          finisherType: 'Leap',
          ambiguousFieldSelection: 'oldest'
        }
      })
    });
  if (burning)
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        name: 'Conduit Surge — Burning',
        skillName: 'Conduit Surge',
        condition: String(burning.condition),
        stacks: Number(burning.stacks),
        duration: Number(burning.duration),
        source: 'engineer',
        sourceId: event.skillId ?? event.sourceId,
        actorType: 'player',
        activationId: event.activationId,
        offTarget: event.offTarget
      })
    });
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
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        name: 'Electric Artillery',
        coefficient: Number(strike.coefficient),
        explosion: true
      })
    });
  if (immobilize)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Electric Artillery',
        condition: String(immobilize.condition),
        stacks: Number(immobilize.stacks),
        duration: Number(immobilize.duration)
      }),
      settlement: 'reaction'
    });
  // The tooltip specifies charges required per stack: one when Focused, otherwise two.
  if (vulnerability) {
    const vulnerabilityStacks =
      Math.floor(charges / balanceProfileNumber(idProfile, 'chargesPerVulnerability')) * Number(vulnerability.stacks);
    if (vulnerabilityStacks > 0) {
      context.effects.emit({
        kind: 'packet',
        event: buildEngineerCondition(event, {
          name: 'Electric Artillery',
          condition: String(vulnerability.condition),
          stacks: vulnerabilityStacks,
          duration: Number(vulnerability.duration),
          // Artillery's Vulnerability does not scale with condition duration.
          metadata: { fixedDuration: true }
        }),
        settlement: 'reaction'
      });
    }
  }

  if (burning) {
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        name: 'Electric Artillery — Burning',
        skillName: 'Electric Artillery',
        condition: 'Burning',
        stacks: Number(burning.stacks),
        duration: Number(burning.duration) + charges * balanceProfileNumber(idProfile, 'burningDurationPerCharge'),
        source: 'engineer',
        sourceId: event.skillId ?? event.sourceId,
        actorType: 'player',
        activationId: event.activationId,
        offTarget: event.offTarget
      })
    });
  }
}
