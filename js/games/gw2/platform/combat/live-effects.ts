/** Owns private grant copies and companion lifetimes. Queries share records and projections under readonly contracts. */
import {
  applyBoonExtension,
  buffApplicationStacks,
  buffMatchesAudience,
  isDurationStackingBoon,
  isStandardBoon,
  orderedDurationBoonRemaining,
  recordBuffApplication,
  type Gw2TimedBuffApplication
} from '#gw2/platform/combat/boons.js';
import { observeGenericBuff, type BuffObservation } from '#gw2/platform/combat/effect-observation.js';
import type { BuffStatePolicy, EffectState } from '#gw2/platform/combat/effect-state.js';
import { liveBoonSnapshot, type EffectRecipient } from '#gw2/platform/combat/query/effect-stacks.js';
import {
  gw2BoonApplicationRecipients,
  gw2BuffApplicationRecipients
} from '#gw2/platform/combat/state/allied-players.js';
import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import type { ResolvedEffectAudience, SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { cloneData } from '#kernel/core/clone.js';

type Applications = readonly Readonly<Gw2TimedBuffApplication>[];
type EffectStore = Map<string, Gw2TimedBuffApplication[]>;
interface RecipientStores {
  boons: EffectStore;
  buffs: EffectStore;
}
const empty: Applications = Object.freeze([]);

export function createLiveEffects(config: Gw2Config = {}) {
  const boons: EffectStore = new Map();
  const buffs: EffectStore = new Map();
  const companions = new Map<string, RecipientStores>();
  const retired = new Map<string, number>();
  const effectObservations = new Map<string, BuffObservation>();
  const effectKinds = new Map<EffectStore, readonly string[]>();
  const histories = new WeakMap<Gw2TimedBuffApplication[], Applications>();
  const observeHistory = (applications: Gw2TimedBuffApplication[] | undefined): Applications => {
    if (!applications) return empty;

    let result = histories.get(applications);

    // Grants append; revisions replace arrays. Neither can silently retain an obsolete observation.
    if (!result || result.length !== applications.length) {
      result = Object.freeze(applications.slice());
      histories.set(applications, result);
    }

    return result;
  };

  const storesFor = (recipient?: EffectRecipient): RecipientStores | undefined =>
    recipient?.actor === 'companion' ? companions.get(recipient.companionId ?? '') : { boons, buffs };
  const recipients = (event: SimulationEvent): ResolvedEffectAudience => {
    const audience = isStandardBoon((event.kind ?? '').toLowerCase())
      ? gw2BoonApplicationRecipients(config, event)
      : gw2BuffApplicationRecipients(config, event);
    const companionIds = audience.companionIds.filter((id) => event.at < (retired.get(id) ?? Infinity));
    // Grant acceptance clones the complete packet, including this selected audience, once.
    return companionIds.length === audience.companionIds.length
      ? audience
      : {
          ...audience,
          companionIds,
          includesSummons: companionIds.length > 0,
          recipientCount: audience.recipientCount - audience.companionIds.length + companionIds.length
        };
  };

  const queries = Object.freeze({
    companionRetiredAt: (id: string): number | undefined => retired.get(id),
    get retirementCount(): number {
      return retired.size;
    },
    boonApplications: (kind: string, recipient?: EffectRecipient): Applications =>
      observeHistory(storesFor(recipient)?.boons.get(kind)),
    buffApplications: (kind: string, recipient?: EffectRecipient): Applications =>
      observeHistory(storesFor(recipient)?.buffs.get(kind)),
    /** Latest accepted grant at a time, optionally restricted to one recipient, without copying its history. */
    latestApplication(
      kind: string,
      at: number,
      recipient?: EffectRecipient
    ): Readonly<Gw2TimedBuffApplication> | undefined {
      const stores = storesFor(recipient);
      const applications = (isStandardBoon(kind) ? stores?.boons : stores?.buffs)?.get(kind);

      if (!applications) return undefined;

      for (let index = applications.length - 1; index >= 0; index--) {
        const application = applications[index]!;

        if (application.at > at) continue;

        if (
          recipient &&
          !buffMatchesAudience(
            application,
            recipient.actor === ACTOR.PLAYER ? RECIPIENT.SELF : RECIPIENT.SUMMONS,
            recipient.actor === 'companion' ? recipient.companionId : undefined
          )
        )
          continue;

        return application;
      }

      return undefined;
    },
    /** Reporting selects kinds and projected states without copying the accepted application arrays. */
    effectKinds(category: 'boon' | 'buff'): readonly string[] {
      const store = category === 'boon' ? boons : buffs;
      let kinds = effectKinds.get(store);

      if (!kinds || kinds.length !== store.size) {
        kinds = Object.freeze([...store.keys()]);
        effectKinds.set(store, kinds);
      }

      return kinds;
    },
    effectStates(kind: string, at: number, policy: BuffStatePolicy, playerOnly: boolean): readonly EffectState[] {
      const applications = (isStandardBoon(kind) ? boons : buffs).get(kind) ?? empty;
      return observeGenericBuff(effectObservations, kind, applications, at, policy, playerOnly);
    },
    stacks(kind: string, at: number, maximum: number, recipient: EffectRecipient = { actor: ACTOR.PLAYER }): number {
      const companionId = recipient.actor === 'companion' ? recipient.companionId : undefined;

      if (companionId && at >= (retired.get(companionId) ?? Infinity)) return 0;

      const stores = storesFor(recipient);
      const applications = (isStandardBoon(kind) ? stores?.boons : stores?.buffs)?.get(kind) ?? empty;
      return buffApplicationStacks(applications, kind, at, maximum, {
        audience: recipient.actor === ACTOR.PLAYER ? RECIPIENT.SELF : RECIPIENT.SUMMONS,
        companionId,
        ordered: true
      });
    },
    boonSnapshot(kind: string, at: number, recipient: EffectRecipient) {
      if (
        recipient.actor === 'companion' &&
        recipient.companionId &&
        at >= (retired.get(recipient.companionId) ?? Infinity)
      )
        return { stacks: 0, duration: 0 };

      return liveBoonSnapshot(storesFor(recipient)?.boons.get(kind) ?? empty, config, kind, at, recipient);
    },
    /** Executed duration only, without configured boon assumptions; repeated reads share the private replay cursor. */
    boonDuration(kind: string, at: number, recipient: EffectRecipient = { actor: ACTOR.PLAYER }): number {
      if (!isDurationStackingBoon(kind)) return 0;

      const companionId = recipient.actor === 'companion' ? recipient.companionId : undefined;

      if (companionId && at >= (retired.get(companionId) ?? Infinity)) return 0;

      return orderedDurationBoonRemaining(
        storesFor(recipient)?.boons.get(kind) ?? empty,
        kind,
        at,
        recipient.actor === ACTOR.PLAYER ? RECIPIENT.SELF : RECIPIENT.SUMMONS,
        companionId
      );
    }
  });
  return Object.freeze({
    queries,
    /** Accounting observes accepted recipients before the stores change; reactions run after the grant returns. */
    grant(event: SimulationEvent, observeAccepted?: (audience: ResolvedEffectAudience) => void): void {
      const accepted = cloneData({ ...event, resolvedAudience: recipients(event) });
      observeAccepted?.(accepted.resolvedAudience);
      const category = isStandardBoon((event.kind ?? '').toLowerCase()) ? 'boons' : 'buffs';
      recordBuffApplication(category === 'boons' ? boons : buffs, accepted);
      for (const id of accepted.resolvedAudience.companionIds) {
        let stores = companions.get(id);

        if (!stores) {
          stores = { boons: new Map(), buffs: new Map() };
          companions.set(id, stores);
        }

        recordBuffApplication(stores[category], {
          ...accepted,
          resolvedAudience: {
            ...accepted.resolvedAudience,
            includesSelf: false,
            includesSummons: true,
            alliedPlayerCount: 0,
            companionIds: [id],
            recipientCount: 1
          }
        });
      }
    },
    extend(event: SimulationEvent): void {
      // Extensions preserve prior observations by appending or replacing records.
      applyBoonExtension(boons, event);
      for (const stores of companions.values()) applyBoonExtension(stores.boons, event);
    },
    reviseBuffExpiry(
      kind: string,
      select: (application: Readonly<Gw2TimedBuffApplication>) => boolean,
      expiry: (at: number) => number
    ): void {
      for (const store of [buffs, ...[...companions.values()].map((stores) => stores.buffs)]) {
        const applications = store.get(kind);

        if (applications)
          store.set(
            kind,
            applications.map((application) =>
              select(application) ? { ...application, expiresAt: expiry(application.expiresAt) } : application
            )
          );
      }
    },
    /** Return whether retirement was new so the resolver retires condition ownership exactly once. */
    retireCompanion(id: string, at: number): boolean {
      if (retired.has(id)) return false;

      retired.set(id, at);
      companions.delete(id);
      return true;
    }
  });
}

export type LiveEffects = ReturnType<typeof createLiveEffects>;

export type LiveEffectQueries = LiveEffects['queries'];
