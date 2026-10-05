import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ProcStep, Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import type { BalanceProfile, Skill, SkillId } from '#gw2/platform/skills/types.js';

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
  readonly cause?: Gw2ResolverEvent | null;
  readonly owner?: WorkOwner;
  readonly priority?: number;
  /** The mechanic can name a triggering skill as its modifier context without changing the granting source. */
  readonly durationContext?: Gw2ResolverEvent;
}

export interface PacketEmission extends EffectDelivery {
  readonly kind: 'packet';
  readonly event: SimulationEventBase;
  /** A condition inside the current reaction transaction must settle before the caller's next state query. */
  readonly settlement?: 'reaction';
}

export interface ProfileEmission extends EffectDelivery {
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

export interface AnnouncementEmission extends EffectDelivery {
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
    readonly effectState?: Gw2ProcStep['effectState'];
  };
}

/** Every producer uses the same service; only payload authoring differs between a profile and a computed packet. */
export interface EffectEmissionService {
  emit(request: PacketEmission): SimulationEvent;
  emit(request: ProfileEmission): readonly SimulationEvent[];
  emit(request: AnnouncementEmission): SimulationEvent;
}

/** Receipts detach nested payloads so retaining causality cannot mutate pending combat work. */
function immutableReceipt(event: SimulationEvent): SimulationEvent {
  const receipt = structuredClone(event);
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

/** Delivery is data; profile selection callbacks stay outside the queued packet's snapshot. */
function deliverySnapshot(
  request: EffectDelivery & { readonly settlement?: 'reaction' }
): EffectDelivery & { readonly settlement?: 'reaction' } {
  return structuredClone({
    cast: request.cast,
    cause: request.cause,
    owner: request.owner,
    priority: request.priority,
    durationContext: request.durationContext,
    settlement: request.settlement
  });
}

/** Expand authored effects once and submit computed and materialized packets to the same runtime boundary. */
export function createEffectEmissionService(host: {
  readonly now: () => number;
  readonly registerReaction: (profile: Skill | BalanceProfile, effect: SkillEffect) => number | undefined;
  readonly submit: (
    event: SimulationEventBase,
    delivery: EffectDelivery & { readonly settlement?: 'reaction' }
  ) => SimulationEvent;
  readonly announce: (request: AnnouncementEmission) => SimulationEvent;
}): EffectEmissionService {
  function emit(request: PacketEmission): SimulationEvent;
  function emit(request: ProfileEmission): readonly SimulationEvent[];
  function emit(request: AnnouncementEmission): SimulationEvent;
  function emit(
    request: PacketEmission | ProfileEmission | AnnouncementEmission
  ): SimulationEvent | readonly SimulationEvent[] {
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
    if (request.kind === 'announcement')
      return immutableReceipt(
        host.announce({
          ...delivery,
          kind: 'announcement',
          log: request.log,
          attribution: structuredClone(request.attribution),
          announcement: structuredClone(request.announcement)
        })
      );
    if (request.kind === 'packet') return immutableReceipt(host.submit(structuredClone(request.event), delivery));
    const at = request.at ?? host.now();
    const events: SimulationEvent[] = [];
    for (const effect of request.effects ?? request.profile.effects ?? []) {
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
        if (packet) events.push(immutableReceipt(host.submit(structuredClone(packet), delivery)));
      }
    }

    return Object.freeze(events);
  }

  return Object.freeze({ emit });
}
