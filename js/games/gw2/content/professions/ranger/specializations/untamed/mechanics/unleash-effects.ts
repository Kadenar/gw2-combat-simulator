import { enqueueOrdered } from '../../../../../../../../kernel/events/queue.js';
import { isInternalCooldownReady } from '../../../../../../../../kernel/core/clock.js';
import { hasTrait } from '../../../../../../platform/combat/state/traits.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '../../../data/ids.js';
import type { RangerResolverContext, RangerResolverEvent } from '../../../types.js';
import { untamedState } from '../state.js';
import { rangerBalanceProfile, rangerBalanceProfileEffect } from '../../../core/profiles.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';

function profileEffect(context: unknown, id: number | string, type: string, index = 0) {
  return rangerBalanceProfileEffect(rangerBalanceProfile(context, id), type, index);
}

const AMBUSH_SKILL_IDS = new Set<number>([ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE]);

export function handleUntamedState(context: RangerResolverContext, event: RangerResolverEvent): void {
  // Sync the resolver's independent copy of rangerUnleashed from the scheduler-emitted event.
  untamedState.from(context).rangerUnleashed = event.rangerUnleashed === true;
}

export const untamedEventHandlers = Object.freeze({
  'ranger.untamed-state': handleUntamedState
});

// Floating-point guard: prevents a cooldown check from failing due to sub-nanosecond rounding.
function epsilon(context: RangerResolverContext): number {
  return Number(context.epsilon || 1e-9);
}

function isPetStrike(event: RangerResolverEvent): boolean {
  return event.source === 'ranger-pet';
}

function isPlayerStrike(event: RangerResolverEvent): boolean {
  return event.actorType === 'player' && !isPetStrike(event);
}

function queueTraitBuff(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  kind: string,
  duration: number,
  stacks: number,
  sourceId: number,
  name: string,
  party = false
): void {
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    source: 'Trait',
    sourceId,
    actorType: 'effect',
    skillId: sourceId,
    skillName: name,
    name: `${name} - ${kind}`,
    kind,
    duration,
    stacks,
    ...(party ? { recipients: 'party', maximumRecipients: 5 } : {}),
    triggeredBy: event.skillName
  });
}

function queueTraitCondition(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  condition: string,
  duration: number,
  stacks: number,
  sourceId: number,
  name: string
): void {
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    source: 'Trait',
    sourceId,
    actorType: 'effect',
    skillId: sourceId,
    skillName: name,
    name: `${name} - ${condition}`,
    condition,
    duration,
    stacks,
    triggeredBy: event.skillName
  });
}

function triggerFerociousSymbiosis(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (!hasTrait(context, TRAIT.FEROCIOUS_SYMBIOSIS)) return;
  const state = untamedState.from(context);
  const profile = rangerBalanceProfile(context, PROFILE.ferociousSymbiosis);
  const maximumStacks = Number(profile?.maximumStacks ?? 5);
  const duration = Number(profile?.durationMultiplier ?? 5);
  const internalCooldown = Number(profile?.internalCooldown ?? 0.5);
  if (isPlayerStrike(event)) {
    if (!isInternalCooldownReady(event.at, state.ferociousSymbiosisPetReadyAt)) return;
    // A player hit builds Pet stacks (cross-buff: player hits power the pet).
    state.ferociousSymbiosisPetStacks =
      event.at < state.ferociousSymbiosisPetUntil ? Math.min(maximumStacks, state.ferociousSymbiosisPetStacks + 1) : 1;
    state.ferociousSymbiosisPetUntil = event.at + duration;
    state.ferociousSymbiosisPetReadyAt = event.at + internalCooldown;
  } else if (isPetStrike(event)) {
    if (!isInternalCooldownReady(event.at, state.ferociousSymbiosisPlayerReadyAt)) return;
    // A pet hit builds Player stacks (cross-buff: pet hits power the player).
    state.ferociousSymbiosisPlayerStacks =
      event.at < state.ferociousSymbiosisPlayerUntil
        ? Math.min(maximumStacks, state.ferociousSymbiosisPlayerStacks + 1)
        : 1;
    state.ferociousSymbiosisPlayerUntil = event.at + duration;
    state.ferociousSymbiosisPlayerReadyAt = event.at + internalCooldown;
  }
}

function triggerLetLoose(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (
    !hasTrait(context, TRAIT.LET_LOOSE) ||
    // Let Loose only procs on the two ambush skills (Relentless Whirl, Deft Strike).
    !AMBUSH_SKILL_IDS.has(Number(event.skillId)) ||
    // activationId is absent on synthetic events; guard prevents double-counting.
    !event.activationId
  ) {
    return;
  }

  const activations = untamedState.from(context).letLooseActivations;
  // Each ambush activation grants boons exactly once even if the skill hits multiple times.
  if (activations[event.activationId]) return;
  activations[event.activationId] = true;
  const quickness = profileEffect(context, PROFILE.letLoose, 'boon', 0);
  const might = profileEffect(context, PROFILE.letLoose, 'boon', 1);
  queueTraitBuff(
    context,
    event,
    String(quickness?.boon || 'quickness'),
    Number(quickness?.duration ?? 5),
    Number(quickness?.stacks ?? 1),
    TRAIT.LET_LOOSE,
    'Let Loose',
    true
  );
  queueTraitBuff(
    context,
    event,
    String(might?.boon || 'might'),
    Number(might?.duration ?? 10),
    Number(might?.stacks ?? 5),
    TRAIT.LET_LOOSE,
    'Let Loose',
    true
  );
}

function triggerBlindingOutburst(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (event.skillId !== ID.VENOMOUS_OUTBURST || !hasTrait(context, TRAIT.BLINDING_OUTBURST)) {
    return;
  }

  const blindness = profileEffect(context, PROFILE.blindingOutburst, 'condition');
  queueTraitCondition(
    context,
    event,
    String(blindness?.condition || 'Blindness'),
    Number(blindness?.duration ?? 2),
    Number(blindness?.stacks ?? 1),
    TRAIT.BLINDING_OUTBURST,
    'Blinding Outburst'
  );
}

export function reactToUntamedDamage(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (
    // Only hitting strikes (coefficient > 0) advance trait state; misses and barrier hits are excluded.
    !(Number(event.coefficient) > 0) ||
    (!isPlayerStrike(event) && !isPetStrike(event))
  ) {
    return;
  }

  triggerBlindingOutburst(context, event);
  triggerFerociousSymbiosis(context, event);
  // Let Loose is player-only; pet hits cannot trigger it.
  if (isPlayerStrike(event)) triggerLetLoose(context, event);
}

export function reactToUntamedControl(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (!isPlayerStrike(event) && !isPetStrike(event)) return;
  const state = untamedState.from(context);
  if (
    hasTrait(context, TRAIT.DEBILITATING_BLOWS) &&
    isInternalCooldownReady(event.at, state.debilitatingBlowsReadyAt)
  ) {
    const profile = rangerBalanceProfile(context, PROFILE.debilitatingBlows);
    state.debilitatingBlowsReadyAt = event.at + Number(profile?.internalCooldown ?? 1);
    // Unleash state determines which condition is applied: Poisoned when Ranger unleashed, Slow otherwise.
    if (state.rangerUnleashed) {
      const poison = rangerBalanceProfileEffect(profile, 'condition', 0);
      queueTraitCondition(
        context,
        event,
        String(poison?.condition || 'Poisoned'),
        Number(poison?.duration ?? 5),
        Number(poison?.stacks ?? 2),
        TRAIT.DEBILITATING_BLOWS,
        'Debilitating Blows'
      );
    } else {
      const slow = rangerBalanceProfileEffect(profile, 'condition', 1);
      queueTraitCondition(
        context,
        event,
        String(slow?.condition || 'Slow'),
        Number(slow?.duration ?? 2),
        Number(slow?.stacks ?? 2),
        TRAIT.DEBILITATING_BLOWS,
        'Debilitating Blows'
      );
    }
  }

  if (hasTrait(context, TRAIT.ENHANCING_IMPACT) && isInternalCooldownReady(event.at, state.enhancingImpactReadyAt)) {
    const profile = rangerBalanceProfile(context, PROFILE.enhancingImpact);
    const effect = rangerBalanceProfileEffect(profile, 'boon', state.rangerUnleashed ? 0 : 1);
    state.enhancingImpactReadyAt = event.at + Number(profile?.internalCooldown ?? 1);
    // Unleash state determines the boon: Quickness when Ranger unleashed, Stability otherwise.
    queueTraitBuff(
      context,
      event,
      String(effect?.boon || (state.rangerUnleashed ? 'quickness' : 'stability')),
      Number(effect?.duration ?? 3),
      Number(effect?.stacks ?? 1),
      TRAIT.ENHANCING_IMPACT,
      'Enhancing Impact'
    );
  }
}
