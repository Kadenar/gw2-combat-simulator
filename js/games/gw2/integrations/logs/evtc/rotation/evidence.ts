import { usesModernAnimations } from '#gw2/integrations/logs/evtc/recording.js';
import { legacyActivationActions, modernAnimationActions } from '#gw2/integrations/logs/evtc/rotation/animations.js';
import type { EvtcPlayerEvidence } from '#gw2/integrations/logs/evtc/rotation/players.js';
import type { EvtcRecordedRotationAction } from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import type { ParsedEvtc, ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';

export interface IndexedEvent {
  readonly event: ParsedEvtcEvent;
  readonly eventIndex: number;
}

export interface EffectEvidence extends IndexedEvent {
  readonly guid: string;
  readonly dynamicEndTime?: number;
}

export interface EvtcReconstructionEvidence {
  readonly owners: ReadonlyMap<bigint, bigint>;
  readonly effects: readonly EffectEvidence[];
  readonly hasEffects: boolean;
  readonly names: ReadonlyMap<number, string>;
  readonly eventsBySkill: ReadonlyMap<number, readonly IndexedEvent[]>;
  readonly animationsFor: (address: bigint) => readonly EvtcRecordedRotationAction[];
}

/** Prepare log-wide raw indexes once; reuse player casts and decode other actors only on first demand. */
export function prepareEvtcEvidence(
  log: ParsedEvtc,
  players: readonly EvtcPlayerEvidence[] = []
): EvtcReconstructionEvidence {
  const names = new Map(log.skills.map((skill) => [skill.id, skill.name]));
  const eventsBySkill = new Map<number, IndexedEvent[]>();
  let hasEffects = false;
  log.events.forEach((event, eventIndex) => {
    const group = eventsBySkill.get(event.skillId) ?? [];
    group.push({ event, eventIndex });
    eventsBySkill.set(event.skillId, group);

    if ([45, 51, 60, 62, 79].includes(event.stateChange) && event.skillId !== 0) hasEffects = true;
  });
  const animations = new Map(players.map(({ agent, castActions }) => [agent.address, castActions]));
  const decode = usesModernAnimations(log) ? modernAnimationActions : legacyActivationActions;
  return {
    owners: agentOwners(log),
    effects: effectEvidence(log),
    hasEffects,
    names,
    eventsBySkill,
    animationsFor(address) {
      let actions = animations.get(address);

      if (actions == null) {
        actions = decode(log, address, names);
        animations.set(address, actions);
      }

      return actions;
    }
  };
}

/** Resolve stable final masters, rejecting ambiguous reused instances instead of crediting the wrong player. */
function agentOwners(log: ParsedEvtc): ReadonlyMap<bigint, bigint> {
  const addresses = new Set(log.agents.map((a) => a.address));
  const instances = new Map<number, bigint>();
  const masterInstances = new Map<bigint, number>();
  const ambiguousInstances = new Set<number>();
  const ambiguousMasters = new Set<bigint>();
  const record = (address: bigint, instance: number, master: number): void => {
    if (!addresses.has(address)) return;

    if (instance) {
      if (instances.has(instance) && instances.get(instance) !== address) ambiguousInstances.add(instance);

      instances.set(instance, address);
    }

    if (master) {
      if (masterInstances.has(address) && masterInstances.get(address) !== master) ambiguousMasters.add(address);

      masterInstances.set(address, master);
    }
  };

  for (const event of log.events) {
    record(event.source, event.sourceInstance, event.sourceMasterInstance);
    record(event.target, event.targetInstance, event.targetMasterInstance);
  }

  const owners = new Map<bigint, bigint>();
  for (const address of masterInstances.keys()) {
    const visited = new Set<bigint>();
    let owner = address;
    let ambiguous = false;
    while (!visited.has(owner)) {
      visited.add(owner);

      if (ambiguousMasters.has(owner) || ambiguousInstances.has(masterInstances.get(owner) ?? 0)) {
        ambiguous = true;
        break;
      }

      const next = instances.get(masterInstances.get(owner) ?? 0);

      if (next == null) break;

      if (visited.has(next)) {
        ambiguous = true;
        break;
      }

      owner = next;
    }

    if (!ambiguous && owner !== address) owners.set(address, owner);
  }

  return owners;
}

function guidPart(value: bigint): string {
  return Array.from({ length: 8 }, (_, i) =>
    Number((value >> BigInt(i * 8)) & 255n)
      .toString(16)
      .padStart(2, '0')
  )
    .join('')
    .toUpperCase();
}

/** IDToGUID namespaces are independent; only effect mappings identify effect creations. */
function effectEvidence(log: ParsedEvtc): EffectEvidence[] {
  const guids = new Map(
    log.events
      .filter((e) => e.stateChange === 46 && (e.overstackValue & 255) === 0)
      .map((e) => [e.skillId, guidPart(e.source) + guidPart(e.target)])
  );
  const effects: (IndexedEvent & { guid: string; dynamicEndTime?: number })[] = [];
  const tracked = new Map<string, typeof effects>();
  // EI's EffectEndEvent classes select the last creation at or before removal; SetDynamicEndTime keeps its first end.
  log.events.forEach((event, eventIndex) => {
    if (![45, 51, 60, 61, 62, 63, 79].includes(event.stateChange)) return;

    const namespace = event.stateChange === 51 ? 51 : [60, 61].includes(event.stateChange) ? 60 : 62;
    const trackingId =
      event.stateChange === 51
        ? (event.buffRemove | (event.ninety << 8) | (event.fifty << 16) | (event.moving << 24)) >>> 0
        : [60, 61, 62, 63].includes(event.stateChange)
          ? event.pad
          : 0;
    const key = `${namespace}:${trackingId}`;
    const removal =
      event.stateChange === 61 || event.stateChange === 63 || (event.stateChange === 51 && event.skillId === 0);

    if (removal) {
      const creation = trackingId
        ? tracked
            .get(key)
            ?.filter((effect) => effect.event.time <= event.time)
            .at(-1)
        : undefined;

      if (creation && creation.dynamicEndTime == null) creation.dynamicEndTime = event.time;

      return;
    }

    const guid = guids.get(event.skillId);

    if (event.skillId === 0) return;

    const effect = { event, eventIndex, guid: guid ?? '' };

    if (guid) effects.push(effect);

    // Unmapped creations still claim their tracking ID, so a later removal cannot end an older mapped effect.
    if (trackingId) {
      const creations = tracked.get(key) ?? [];
      creations.push(effect);
      tracked.set(key, creations);
    }
  });
  return effects;
}
