import type { ParsedEvtc, ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { EI_INSTANT_RULES } from '#gw2/integrations/logs/evtc/rotation/ei-rules.js';
import { legacyActivationActions, modernAnimationActions } from '#gw2/integrations/logs/evtc/rotation/animations.js';
import { usesModernAnimations } from '#gw2/integrations/logs/evtc/recording.js';

/** EI BuffGainCastFinder excludes snapshots and extensions; custom animated finders opt into snapshots explicitly. */
export function isBuffApply(log: ParsedEvtc, event: ParsedEvtcEvent, initial = false): boolean {
  if (event.stateChange === 18) return initial;
  return Number(log.header.arcdpsBuild) >= 20260501
    ? event.stateChange === 69
    : event.stateChange === 0 &&
        event.buff !== 0 &&
        event.buffDamage === 0 &&
        event.value > 0 &&
        event.activation === 0 &&
        event.buffRemove === 0;
}

export function isBuffRemoveAll(log: ParsedEvtc, event: ParsedEvtcEvent): boolean {
  return Number(log.header.arcdpsBuild) >= 20260501
    ? event.stateChange === 72
    : event.stateChange === 0 && event.activation === 0 && event.buffRemove === 1;
}

/** Resolve stable final masters, rejecting ambiguous reused instances instead of crediting the wrong player. */
export function agentOwners(log: ParsedEvtc): ReadonlyMap<bigint, bigint> {
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
export function effectEvidence(log: ParsedEvtc): { event: ParsedEvtcEvent; eventIndex: number; guid: string }[] {
  const guids = new Map(
    log.events
      .filter((e) => e.stateChange === 46 && (e.overstackValue & 255) === 0)
      .map((e) => [e.skillId, guidPart(e.source) + guidPart(e.target)])
  );
  return log.events.flatMap((event, eventIndex) => {
    const guid = guids.get(event.skillId);
    return guid && event.skillId !== 0 && [45, 51, 60, 62, 79].includes(event.stateChange)
      ? [{ event, eventIndex, guid }]
      : [];
  });
}

/** EI's ordinary finders use specific evidence, half-open version ranges and a sliding duplicate window. */
export function eiInstantActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const { log, profile, playerAddress } = context;
  const evtcBuild = Number(log.header.arcdpsBuild);
  const gw2Build = Number(log.events.find((e) => e.stateChange === 15)?.source ?? 0n);
  const owners = agentOwners(log);
  const species = new Map(
    log.agents.filter((a) => a.elite === 0xffffffff).map((a) => [a.address, a.profession & 0xffff])
  );
  const effects = effectEvidence(log);
  const hasEffects = log.events.some((e) => [45, 51, 60, 62, 79].includes(e.stateChange) && e.skillId !== 0);
  const eventsBySkill = new Map<number, { event: ParsedEvtcEvent; eventIndex: number }[]>();
  log.events.forEach((event, eventIndex) => {
    const group = eventsBySkill.get(event.skillId) ?? [];
    group.push({ event, eventIndex });
    eventsBySkill.set(event.skillId, group);
  });
  const names = new Map(log.skills.map((s) => [s.id, s.name]));
  const swaps = log.events.filter((e) => e.stateChange === 11);
  const actions: EvtcRecordedRotationAction[] = [];
  const rules = EI_INSTANT_RULES.filter(
    (r) =>
      r.profession === profile.professionId &&
      (!r.specialization || r.specialization === profile.specializationId) &&
      r.excludeSpec !== profile.specializationId &&
      gw2Build >= (r.minBuild ?? 0) &&
      gw2Build < (r.maxBuild ?? Infinity) &&
      evtcBuild >= (r.minEvtcBuild ?? 0) &&
      evtcBuild < (r.maxEvtcBuild ?? Infinity) &&
      !(r.disableWithEffects && hasEffects)
  );
  for (const rule of rules) {
    const finalOwner = rule.minions || rule.kind === 'buff-give' || rule.kind === 'minion-command';
    const owns = (address: bigint): boolean =>
      (finalOwner ? (owners.get(address) ?? address) : address) === playerAddress;
    let signals: { event: ParsedEvtcEvent; eventIndex: number; time?: number }[];
    if (rule.kind === 'effect' || rule.kind === 'effect-dst') {
      const caster = (e: ParsedEvtcEvent): bigint => (rule.kind === 'effect-dst' ? e.target : e.source);
      signals = effects.filter(
        (e) =>
          e.guid === rule.signal &&
          owns(caster(e.event)) &&
          (rule.kind !== 'effect-dst' || ![60, 79].includes(e.event.stateChange)) &&
          (rule.secondary ?? []).every((guid) =>
            effects.some(
              (other) =>
                other !== e &&
                other.guid === guid &&
                owns(caster(other.event)) &&
                Math.abs(other.event.time - e.event.time) < 10
            )
          )
      );
    } else if (rule.kind === 'minion-cast') {
      signals = [...owners]
        .filter(([, owner]) => owner === playerAddress)
        .flatMap(([address]) =>
          (usesModernAnimations(log) ? modernAnimationActions : legacyActivationActions)(log, address, names)
            .filter((a) => a.rawSkillId === rule.signal)
            .map((a) => ({ event: log.events[a.eventIndex], eventIndex: a.eventIndex, time: a.start }))
        );
    } else {
      signals = (eventsBySkill.get(Number(rule.kind === 'minion-command' ? 59536 : rule.signal)) ?? []).flatMap(
        ({ event, eventIndex }) => {
          let matches = false;
          switch (rule.kind) {
            case 'buff-gain':
              matches = isBuffApply(log, event) && owns(event.target);
              break;
            case 'buff-give':
              matches = isBuffApply(log, event) && owns(event.source);
              break;
            case 'buff-loss':
              matches = isBuffRemoveAll(log, event) && owns(event.source);
              break;
            case 'minion-command':
              matches =
                isBuffApply(log, event) &&
                owners.get(event.target) === playerAddress &&
                species.get(event.target) === rule.signal;
              break;
            case 'damage':
              matches =
                event.source === playerAddress &&
                event.stateChange === 0 &&
                (evtcBuild >= 20260501 ||
                  (event.activation === 0 && event.buffRemove === 0 && (event.buff === 0 || event.value === 0))) &&
                (event.buff === 0
                  ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13].includes(event.result)
                  : evtcBuild >= 20260501
                    ? [5, 6, 8, 9, 13, 14, 15, 16, 17, 18].includes(event.result)
                    : event.result < 5);
              break;
          }

          return matches ? [{ event, eventIndex }] : [];
        }
      );
    }

    let lastTime = -Infinity;
    for (const { event, eventIndex, time: sourceTime } of signals.sort(
      (a, b) => (a.time ?? a.event.time) - (b.time ?? b.event.time)
    )) {
      const time = sourceTime ?? event.time;
      const duplicate = time - lastTime < (rule.icd ?? 50);
      // EI MinionCastCastFinder does not advance the accepted-event clock or apply offsets.
      if (rule.kind !== 'minion-cast' || duplicate) lastTime = time;
      if (duplicate) continue;
      let start = time + (rule.kind === 'minion-cast' ? 0 : (rule.timeOffset ?? 0));
      if (rule.swapOffset) {
        const swap = swaps.find((e) => e.source === playerAddress && Math.abs(e.time - start) < 5);
        if (swap) start = rule.swapOffset < 0 ? Math.min(start, swap.time - 1) : Math.max(start, swap.time + 1);
      }

      actions.push({
        start,
        end: start,
        expectedDuration: 0,
        rawSkillId: rule.skillId,
        rawName: names.get(rule.skillId) ?? 'Unknown ' + rule.skillId,
        status: 'instant',
        eventIndex,
        evidence: rule.kind.startsWith('buff-') ? 'buff-transition' : 'effect',
        eiRule: rule.rule,
        castOrigin: rule.origin ?? 'skill',
        metadataAccurate: !(rule.notAccurate || rule.kind.startsWith('effect') || rule.kind === 'damage')
      });
    }
  }

  return actions;
}
