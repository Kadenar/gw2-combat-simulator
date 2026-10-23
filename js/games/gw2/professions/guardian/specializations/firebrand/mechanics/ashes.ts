import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { AlliedStrikeOpportunity } from '#gw2/platform/combat/state/allied-strikes.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';
import {
  resolveAshes,
  type AshesSelection,
  type ResolvedAshes
} from '#gw2/professions/guardian/specializations/firebrand/ashes-tuning.js';
import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import {
  activeChargeCount,
  consumeCharge,
  expireCharges,
  grantCharges
} from '#gw2/platform/combat/resources/charges.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';

import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { ASHES_PROFILE } from '#gw2/professions/guardian/specializations/firebrand/ashes-profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianSkill, GuardianRuntime, GuardianRuntimeState } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

const ASHES = 'guardian.firebrand.ashes';

export const FIREBRAND_ASHES_EXPIRE = 'guardian.firebrand.ashes-expiry';

interface AshesGrantAdmission {
  readonly profile: BalanceProfile;
  readonly buff: SkillEffect;
  readonly triggerIntervalSeconds: number;
}

interface AshesGrantRequest {
  readonly source: 'epilogue' | 'quickfire' | 'fervid-conviction';
  readonly cause: Gw2ResolverEvent;
  readonly charges: number;
  readonly lifetimeSeconds: number;
  readonly recipients: { readonly includesSelf: boolean; readonly maximumAllies: number };
}

/** Admission precedes proc claims; payloads are resolved again when each charge fires. */
export function resolveAshesGrantData(
  selection: AshesSelection,
  profile: BalanceProfile
): AshesGrantAdmission | undefined {
  const buff = requireEffect(profile, 'buff', 'ashes-of-the-just');
  const ashes = resolveAshes(selection);
  return buff && ashes ? { profile, buff, triggerIntervalSeconds: ashes.triggerIntervalSeconds } : undefined;
}

/** Install existing charge stores with source-specific overlap, recipient, and deadline semantics. */
export function grantAshes(runtime: GuardianRuntime, admission: AshesGrantAdmission, request: AshesGrantRequest): void {
  const selfExpiresAt = gw2EffectExpiresAt(runtime.time, request.lifetimeSeconds);
  // Fervid historically uses a raw allied deadline; the other sources share the aligned self deadline.
  const alliedExpiresAt =
    request.source === 'fervid-conviction' ? canonicalTime(runtime.time + request.lifetimeSeconds) : selfExpiresAt;

  if (request.recipients.includesSelf) {
    const state = firebrandState.from(runtime);
    const previous = request.source === 'epilogue' ? undefined : state.ashes;
    state.ashes = grantCharges(request.charges, selfExpiresAt, previous, runtime.time);
    runtime.schedule(FIREBRAND_ASHES_EXPIRE, selfExpiresAt, undefined, undefined, 10);
  }

  // Self-only grants (Quickfire without allied recipients) never touch the allied controller.
  if (request.recipients.maximumAllies <= 0) return;

  const source =
    request.source === 'epilogue'
      ? { priority: 0, skillName: 'Epilogue: Ashes of the Just', name: 'Ashes of the Just' }
      : request.source === 'quickfire'
        ? { priority: 5, skillName: 'Quickfire', name: 'Quickfire' }
        : { priority: 5, skillName: 'Fervid Conviction', name: 'Fervid Conviction' };
  const event = request.cause;
  runtime.alliedStrikes.registerRecipients(
    (allyIndex) => ({
      id: `ashes:${event.activationId}:${event.sourceId}:${runtime.time}:${allyIndex}`,
      expiresAt: alliedExpiresAt,
      inclusiveExpiry: true,
      charges: request.charges,
      consumptionGroup: 'ashes',
      internalCooldown: admission.triggerIntervalSeconds,
      trigger(opportunity) {
        const resolved = resolveAshes(runtime);

        if (!resolved) return false;

        runtime.effects.emit({
          kind: 'packet',
          event: buildAshesBurningPacket(resolved, {
            kind: 'ally',
            grantCause: event,
            opportunity,
            source,
            priority: source.priority
          })
        });
      }
    }),
    { maximumAllies: request.recipients.maximumAllies }
  );
}

type AshesTrigger =
  | { readonly kind: 'self'; readonly strike: GuardianResolverEvent; readonly icon?: string }
  | {
      readonly kind: 'ally';
      readonly grantCause: Gw2ResolverEvent;
      readonly opportunity: AlliedStrikeOpportunity;
      readonly priority: number;
      readonly source: { readonly skillName: string; readonly name: string };
    }
  | { readonly kind: 'inspection'; readonly cause: Gw2ResolverEvent; readonly icon?: string };

// Identity and payload construction are shared; causal fields remain trigger-specific.
function buildAshesBurningPacket(resolved: ResolvedAshes, trigger: AshesTrigger): Gw2ResolverEvent {
  return buildResolverCondition({
    ...ashesTriggerAttribution(trigger),
    source: 'guardian',
    sourceId: 'guardian.ashes-of-the-just',
    actorType: ACTOR.PLAYER,
    skillId: ID.ASHES_OF_THE_JUST,
    condition: CONDITION.BURNING,
    stacks: resolved.burning.stacks,
    duration: resolved.burning.baseDurationSeconds
  });
}

/** Preserve causal and display identity for each trigger without inheriting the triggering skill's payload. */
function ashesTriggerAttribution(trigger: AshesTrigger) {
  if (trigger.kind === 'ally') {
    const { grantCause: event, opportunity: proc, source } = trigger;
    return {
      at: proc.at,
      priority: trigger.priority,
      triggeredBy: event.skillName,
      skillName: source.skillName,
      activationId: `${event.activationId}:ally:${proc.allyIndex}:${proc.activationId}`,
      name: `${source.name} — Ally ${proc.allyIndex} Burning`,
      metadata: { triggeredByAlly: proc.allyIndex }
    };
  }

  const event = trigger.kind === 'self' ? trigger.strike : trigger.cause;
  return {
    at: event.at,
    skillName: 'Epilogue: Ashes of the Just',
    procType: 'profession' as const,
    icon: trigger.icon,
    name: 'Ashes of the Just — Burning',
    activationId: event.activationId,
    causalOrder: event.causalOrder ?? event.eventOrder
  };
}

/** Consume exactly one eligible personal charge; condition settlement retains same-timestamp reaction ordering. */
export function reactToAshesHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  { hitContext }: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  if (!hitContext || !isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0)) return;

  const state = firebrandState.from(context);

  // Most strikes find no live charge; resolve the selected payload only when one could be spent.
  if (activeChargeCount(state.ashes, event.at, true) === 0) return;

  const resolved = resolveAshes(context);

  // A removed payload must not spend a charge.
  if (!resolved || !consumeCharge(state.ashes, event.at, resolved.triggerIntervalSeconds, true)) return;

  emitPersonalAshes(context, event, resolved, 'self');
}

/** Inspect a single selected charge without installing or consuming live charges. */
export function emitAshesForInspection(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const resolved = resolveAshes(context);

  if (resolved) emitPersonalAshes(context, event, resolved, 'inspection');
}

/** Personal and inspection packets share payload and attribution, while allies keep ordinary controller delivery. */
function emitPersonalAshes(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  resolved: ResolvedAshes,
  kind: 'self' | 'inspection'
): void {
  const icon = context.helpers.skillsById.get(ID.ASHES_OF_THE_JUST)?.icon;
  context.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildAshesBurningPacket(
      resolved,
      kind === 'self' ? { kind, strike: event, icon } : { kind, cause: event, icon }
    )
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'profession',
      name: 'Ashes of the Just',
      at: event.at,
      sourceSkill: event.skillName
    }
  });
}

/** Accepted Ashes casts grant after 560 ms, without exposing charges at acceptance or waiting for animation end. */
export function startFirebrandAshes(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>): void {
  runtime.scheduleForCast(ASHES, canonicalTime(cast.start + 0.56), cast);
}

/** The application boundary grants Might and installs the selected charge components together. */
function grantFirebrandAshes(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>): void {
  const event: Gw2ResolverEvent = {
    type: 'buff',
    at: runtime.time,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: ACTOR.PLAYER,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
  const profile = requireBalanceProfileFromContext(runtime, ASHES_PROFILE.epilogueGrant);
  const might = requireEffect(profile, 'boon', boonKey(BOON.MIGHT));

  if (might)
    runtime.effects.emit({
      kind: 'packet',
      event: {
        ...event,
        at: runtime.time,
        kind: boonKey(BOON.MIGHT),
        stacks: effectNumber(profile, might, 'stacks'),
        duration: effectNumber(profile, might, 'duration'),
        audience: { recipients: RECIPIENT.PARTY }
      }
    });

  const admission = resolveAshesGrantData(runtime, profile);

  if (!admission) return;

  const duration = effectNumber(profile, admission.buff, 'duration');
  const charges = effectNumber(profile, admission.buff, 'stacks');
  grantAshes(runtime, admission, {
    source: 'epilogue',
    cause: event,
    charges,
    lifetimeSeconds: duration,
    recipients: { includesSelf: true, maximumAllies: Infinity }
  });
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...event,
      at: runtime.time,
      name: 'Ashes of the Just',
      kind: 'ashes-of-the-just',
      stacks: charges,
      duration,
      audience: { recipients: RECIPIENT.PARTY }
    }
  });
}

const firebrandAshesTasks = {
  [ASHES](runtime: GuardianRuntime, data: unknown) {
    grantFirebrandAshes(runtime, (data as { cast: RuntimeCast<GuardianSkill> }).cast);
  },
  [FIREBRAND_ASHES_EXPIRE](runtime: GuardianRuntime) {
    expireCharges(firebrandState.from(runtime).ashes, runtime.time);
  }
};

/** Registers scheduled Firebrand effect work with the Firebrand hook assembly. */
export const firebrandAshesLifecycle = {
  tasks: firebrandAshesTasks
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
