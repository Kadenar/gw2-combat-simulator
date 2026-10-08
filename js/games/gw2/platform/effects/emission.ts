import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import {
  effectApplicationCount,
  MAX_EFFECT_EXPANSION,
  requireEffectExpansionCount,
  validateConditionExpansion,
  type EffectExpansionBudget
} from '#gw2/platform/effects/expansion-budget.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ProcStep, Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import type { BalanceProfile, Skill, SkillId } from '#gw2/platform/skills/types.js';
import { cloneData } from '#kernel/core/clone.js';

/** Attribution, duration sampling, and cancellation describe independent parts of one emission. */
export interface EffectDelivery {
  readonly cast?: {
    readonly activationId: string;
    readonly skillId: SkillId;
    /** Some mechanics give a derived strike its own combat roll identity. */
    readonly independentSourceStrike?: boolean;
    readonly effectiveEnd?: number;
    readonly offTarget?: boolean;
  };
  readonly cause?: Pick<
    Gw2ResolverEvent,
    'sourceId' | 'actorType' | 'activationId' | 'eventOrder' | 'causalOrder' | 'effectReaction'
  > | null;
  readonly owner?: WorkOwner;
  readonly priority?: number;
  /** The mechanic can name a triggering skill as its modifier context without changing the granting source. */
  readonly durationContext?: Gw2ResolverEvent;
}

/** Only callers retaining submitted events pay for detached, immutable receipts. */
interface EmissionOptions {
  readonly receipt?: boolean;
}

export interface PacketEmission extends EffectDelivery, EmissionOptions {
  readonly kind: 'packet';
  readonly event: SimulationEventBase;
  /** An application inside the current reaction transaction must settle before the caller's next state query. */
  readonly settlement?: 'reaction';
}

export interface ProfileEmission extends EffectDelivery, EmissionOptions {
  readonly kind: 'profile';
  readonly profile: Skill | BalanceProfile;
  readonly effects?: readonly SkillEffect[];
  readonly at?: number;
  readonly fullEnd?: number;
  readonly attribution: EffectEventBase | ((effect: SkillEffect) => EffectEventBase);
  readonly skillWeaponFallback?: string;
  /** Mechanic-owned delivery fields are selected before shared validation and submission. */
  readonly transform?: (event: SimulationEventBase, effect: SkillEffect) => SimulationEventBase | null;
}

export interface AnnouncementEmission extends EffectDelivery, EmissionOptions {
  readonly kind: 'announcement';
  readonly attribution?: EffectEventBase;
  /** A visible activation owns effect rows; timeline-only annotations do not add an event-log row. */
  readonly log?: boolean;
  readonly announcement: {
    readonly type: string;
    readonly name: string;
    readonly at: number;
    readonly sourceSkill?: string;
    readonly detail?: string;
    readonly icon?: string;
    readonly cooldownReduction?: number | null;
    readonly expiresAt?: number | null;
    /** Publish mechanic-owned state only when no accepted buff packet already supplies its chart track. */
    readonly effectState?: Gw2ProcStep['effectState'];
  };
}

/** Every producer uses the same service; only payload authoring differs between a profile and a computed packet. */
export interface EffectEmissionService {
  emit(request: PacketEmission & { readonly receipt: true }): SimulationEvent;
  emit(request: ProfileEmission & { readonly receipt: true }): readonly SimulationEvent[];
  emit(request: AnnouncementEmission & { readonly receipt: true }): SimulationEvent;
  emit(request: PacketEmission | ProfileEmission | AnnouncementEmission): void;
}

/** Receipts detach nested payloads so retaining causality cannot mutate pending combat work. */
function immutableReceipt(event: SimulationEvent): SimulationEvent {
  const receipt = cloneData(event);
  const seen = new WeakSet();
  function freeze(value: unknown): void {
    if (value == null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }

  freeze(receipt);
  return receipt;
}

/** Retain only causal identity; a triggering event's report payload is not part of effect delivery. */
function deliverySnapshot(
  request: EffectDelivery & { readonly settlement?: 'reaction' }
): EffectDelivery & { readonly settlement?: 'reaction' } {
  const cause = request.cause;
  return {
    cast: request.cast ? { ...request.cast } : undefined,
    cause: cause
      ? {
          sourceId: cause.sourceId,
          actorType: cause.actorType,
          activationId: cause.activationId,
          eventOrder: cause.eventOrder,
          causalOrder: cause.causalOrder,
          effectReaction: cause.effectReaction ? { ...cause.effectReaction } : undefined
        }
      : cause,
    owner: request.owner ? { ...request.owner } : undefined,
    priority: request.priority,
    durationContext: request.durationContext ? cloneData(request.durationContext) : undefined,
    settlement: request.settlement
  };
}

/** Expand authored effects once and submit computed and materialized packets to the same runtime boundary. */
export function createEffectEmissionService(host: {
  readonly expansionBudget: EffectExpansionBudget;
  readonly now: () => number;
  readonly registerReaction: (profile: Skill | BalanceProfile, effect: SkillEffect) => number | undefined;
  readonly submit: (
    event: SimulationEventBase,
    delivery: EffectDelivery & { readonly settlement?: 'reaction' }
  ) => SimulationEvent;
  readonly announce: (request: AnnouncementEmission) => SimulationEvent;
}): EffectEmissionService {
  function emit(request: PacketEmission & { readonly receipt: true }): SimulationEvent;
  function emit(request: ProfileEmission & { readonly receipt: true }): readonly SimulationEvent[];
  function emit(request: AnnouncementEmission & { readonly receipt: true }): SimulationEvent;
  function emit(request: PacketEmission | ProfileEmission | AnnouncementEmission): void;
  function emit(
    request: PacketEmission | ProfileEmission | AnnouncementEmission
  ): SimulationEvent | readonly SimulationEvent[] | void {
    // Every ingress validates delivery policy before it can reserve or submit combat work.
    if (request.priority != null && !Number.isFinite(request.priority))
      throw new RangeError('Effect priority must be finite.');
    if (
      request.owner &&
      (typeof request.owner.id !== 'string' ||
        !request.owner.id ||
        !Number.isSafeInteger(request.owner.generation) ||
        request.owner.generation < 0)
    )
      throw new TypeError('Effect lifetime requires an owner id and a nonnegative safe integer generation.');
    const delivery = deliverySnapshot(request);
    if (request.kind === 'announcement') {
      host.expansionBudget.reserve(1, `announcement=${request.announcement.name}`);
      const event = host.announce({
        ...delivery,
        kind: 'announcement',
        log: request.log,
        attribution: cloneData(request.attribution),
        announcement: cloneData(request.announcement)
      });
      return request.receipt ? immutableReceipt(event) : undefined;
    }

    if (request.kind === 'packet') {
      host.expansionBudget.reserve(1, `packet=${request.event.type} source=${request.event.sourceId}`);
      const event = host.submit(cloneData(request.event), delivery);
      return request.receipt ? immutableReceipt(event) : undefined;
    }

    const effects = request.effects ?? request.profile.effects ?? [];
    const label = `${request.profile.name} (${request.profile.id})`;
    if (effects.length > MAX_EFFECT_EXPANSION)
      throw new RangeError(`${label} exceeds the effect expansion limit (${MAX_EFFECT_EXPANSION}).`);
    // Reserve the whole profile before attribution, reaction registration, transforms, allocation, or submission.
    let count = 0;
    for (const effect of effects) {
      const effectLabel = `${label} effect=${effect.type}/${effect.name ?? '<unnamed>'}`;
      count += effectApplicationCount(effect, effectLabel);
      requireEffectExpansionCount(count, label);
      validateConditionExpansion(effect, effectLabel);
    }

    host.expansionBudget.reserve(count, label);
    const at = request.at ?? host.now();
    const events: SimulationEvent[] | undefined = request.receipt ? [] : undefined;
    for (const effect of effects) {
      for (const { event } of materializeSkillEffectApplications({
        skill: request.profile,
        effect,
        reactionGroup: effect.reactions === undefined ? undefined : host.registerReaction(request.profile, effect),
        start: at,
        fullEnd: request.fullEnd ?? at,
        baseEvent: typeof request.attribution === 'function' ? request.attribution(effect) : request.attribution,
        skillWeaponFallback: request.skillWeaponFallback
      })) {
        const packet = request.transform ? request.transform(event, effect) : event;
        if (packet) {
          const submitted = host.submit(cloneData(packet), delivery);
          if (events) events.push(immutableReceipt(submitted));
        }
      }
    }

    return events ? Object.freeze(events) : undefined;
  }

  return Object.freeze({ emit });
}
