import type { ParsedEvtc, ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { EI_INSTANT_RULES } from '#gw2/integrations/logs/evtc/rotation/ei-rules.js';
import { legacyActivationActions, modernAnimationActions } from '#gw2/integrations/logs/evtc/rotation/animations.js';
import { usesModernAnimations } from '#gw2/integrations/logs/evtc/recording.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import {
  MUSHROOM_KINGS_BLESSING_NAME,
  MUSHROOM_KINGS_BLESSING_SKILL_ID
} from '#gw2/integrations/logs/shared/rotation/model.js';

type IndexedEvent = { event: ParsedEvtcEvent; eventIndex: number };

// EI d7f186c WeaverHelper: primary/secondary components resolve to an EI identity before simulator normalization.
const WEAVER_ELEMENTS = [
  { name: 'Fire', basic: 5585, major: 40926, minor: 42811 },
  { name: 'Water', basic: 5586, major: 43236, minor: 43370 },
  { name: 'Air', basic: 5575, major: 41692, minor: 43229 },
  { name: 'Earth', basic: 5580, major: 43740, minor: 44822 }
] as const;
const WEAVER_ATTUNEMENT_IDS = [
  [43470, -5, -6, -7],
  [-8, 41166, -9, -10],
  [-11, -12, 42264, -13],
  [-14, -15, -16, 44857]
];
const WEAVER_ATTUNEMENTS = new Map(
  WEAVER_ELEMENTS.flatMap((primary, row) =>
    WEAVER_ELEMENTS.map(
      (secondary, column) =>
        [
          WEAVER_ATTUNEMENT_IDS[row][column],
          {
            rawName: `${row === column ? 'Dual' : primary.name} ${secondary.name} Attunement`,
            canonicalSkillId: ELEMENTALIST_ATTUNEMENT_SKILL_IDS[primary.name],
            canonicalName: `${primary.name} Attunement`,
            isSwap: true
          }
        ] as const
    )
  )
);

/** Ports EI's Weaver buff transformation for cast inference without mutating the raw log or inventing missing halves. */
function transformWeaverAttunements(
  log: ParsedEvtc,
  playerAddress: bigint,
  eventsBySkill: Map<number, IndexedEvent[]>
): void {
  const modern = Number(log.header.arcdpsBuild) >= 20260501;
  const components = WEAVER_ELEMENTS.flatMap(({ basic, major, minor }, index) => [
    basic,
    major,
    minor,
    WEAVER_ATTUNEMENT_IDS[index][index]
  ]);
  const buffs: (IndexedEvent & { apply: boolean })[] = [];
  for (const id of components) {
    eventsBySkill.set(
      id,
      (eventsBySkill.get(id) ?? []).filter(({ event, eventIndex }) => {
        const application = isBuffApply(log, event, true);
        const extension = modern ? event.stateChange === 70 : application && event.offcycle > 0;
        const removal = modern
          ? [71, 72].includes(event.stateChange)
          : event.stateChange === 0 && event.activation === 0 && event.buffRemove !== 0;
        const selected =
          ((application || extension) && event.target === playerAddress) || (removal && event.source === playerAddress);
        if (selected) buffs.push({ event, eventIndex, apply: application && !extension });
        // Suppress component buffs even when incomplete, just as EI invalidates the original attunement events.
        return !selected;
      })
    );
  }

  const groups: (typeof buffs)[] = [];
  for (const buff of buffs.sort((a, b) => a.event.time - b.event.time || a.eventIndex - b.eventIndex)) {
    const last = groups.at(-1);
    // EI GroupByTime uses a strict 10 ms window anchored at the group's first event, including removals/extensions.
    if (last && buff.event.time - last[0].event.time < 10) last.push(buff);
    else groups.push([buff]);
  }

  for (const group of groups) {
    const applies = group.filter(({ apply }) => apply);
    let primary = -1;
    let secondary = -1;
    let id = 0;
    const loneBasic =
      applies.length === 1 ? WEAVER_ELEMENTS.findIndex(({ basic }) => basic === applies[0].event.skillId) : -1;
    if (loneBasic >= 0) id = WEAVER_ATTUNEMENT_IDS[loneBasic][loneBasic];
    else {
      for (const { event } of applies) {
        if (WEAVER_ATTUNEMENTS.has(event.skillId)) {
          id = event.skillId;
          break;
        }

        const major = WEAVER_ELEMENTS.findIndex(
          ({ basic, major }) => event.skillId === basic || event.skillId === major
        );
        const minor = WEAVER_ELEMENTS.findIndex(({ minor }) => event.skillId === minor);
        if (major >= 0) primary = major;
        else if (minor >= 0) secondary = minor;
      }

      if (!id && primary >= 0 && secondary >= 0) id = WEAVER_ATTUNEMENT_IDS[primary][secondary];
    }

    if (!id) continue;

    // EI creates non-initial applications even from snapshots. Previous-state removals have no cast-finder consumer.
    const synthetic = {
      eventIndex: group[0].eventIndex,
      event: {
        ...applies[0].event,
        time: group[0].event.time,
        source: playerAddress,
        target: playerAddress,
        skillId: id,
        stateChange: modern ? 69 : 0,
        buff: 1,
        value: 2147483647,
        buffDamage: 0,
        activation: 0,
        buffRemove: 0,
        offcycle: 0
      }
    };
    const events = eventsBySkill.get(id) ?? [];
    events.push(synthetic);
    eventsBySkill.set(id, events);
  }
}

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
  const eventsBySkill = new Map<number, IndexedEvent[]>();
  log.events.forEach((event, eventIndex) => {
    const group = eventsBySkill.get(event.skillId) ?? [];
    group.push({ event, eventIndex });
    eventsBySkill.set(event.skillId, group);
  });
  if (profile.specializationId === 'weaver') transformWeaverAttunements(log, playerAddress, eventsBySkill);
  const names = new Map(log.skills.map((s) => [s.id, s.name]));
  // CombatData.HasRelatedHit checks credited damage ownership within the strict 10 ms server tolerance.
  const isDamage = (event: ParsedEvtcEvent): boolean =>
    event.stateChange === 0 &&
    (evtcBuild >= 20260501 ||
      (event.activation === 0 && event.buffRemove === 0 && (event.buff === 0 || event.value === 0))) &&
    (event.buff === 0
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13].includes(event.result)
      : evtcBuild >= 20260501
        ? [5, 6, 8, 9, 13, 14, 15, 16, 17, 18].includes(event.result)
        : event.result < 5);
  const hasRelatedHit = (skillId: number, time: number): boolean =>
    (eventsBySkill.get(skillId) ?? []).some(
      ({ event }) =>
        isDamage(event) &&
        (owners.get(event.source) ?? event.source) === playerAddress &&
        Math.abs(event.time - time) < 10
    );
  const swaps = log.events.filter((e) => e.stateChange === 11);
  const actions: EvtcRecordedRotationAction[] = [];
  const rules = EI_INSTANT_RULES.filter(
    (r) =>
      (r.profession === '*' || r.profession === profile.professionId) &&
      (!r.specialization || r.specialization === profile.specializationId) &&
      gw2Build >= (r.minBuild ?? 0) &&
      gw2Build < (r.maxBuild ?? Infinity) &&
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
          (rule.relatedHit == null || hasRelatedHit(rule.relatedHit, e.event.time)) &&
          (rule.absentRelatedHits ?? []).every((skillId) => !hasRelatedHit(skillId, e.event.time)) &&
          // EI FindRelatedEvents(GetBuffRemoveAllData(...)) checks a strict 10 ms window across all actors.
          (rule.relatedBuffRemoval == null ||
            (eventsBySkill.get(rule.relatedBuffRemoval) ?? []).some(
              ({ event }) => isBuffRemoveAll(log, event) && Math.abs(event.time - e.event.time) < 10
            )) &&
          // EI HasGainedBuff includes initial applications as corroboration; the effect still supplies the cast.
          (rule.gainedBuff == null ||
            (eventsBySkill.get(rule.gainedBuff) ?? []).some(
              ({ event }) =>
                isBuffApply(log, event, true) &&
                event.target === caster(e.event) &&
                Math.abs(event.time - e.event.time) < 10
            )) &&
          (rule.secondary ?? []).every((guid) =>
            effects.some(
              (other) =>
                other !== e &&
                other.guid === guid &&
                owns(caster(other.event)) &&
                Math.abs(other.event.time - e.event.time - (rule.secondaryTimeOffset ?? 0)) < 10
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
            case 'missile':
              // EI MissileCastFinder consumes MissileCreate (57), not launches, removals or damage packets.
              matches = event.stateChange === 57 && owns(event.source);
              break;
            case 'buff-gain':
              matches = isBuffApply(log, event) && owns(event.target);
              break;
            case 'buff-give':
              // Compare the actual source/recipient before final-master attribution, as EI's checker does.
              matches =
                isBuffApply(log, event) &&
                owns(event.source) &&
                (rule.selfAppliedDuration == null ||
                  event.target !== event.source ||
                  Math.abs(event.value - rule.selfAppliedDuration) < 10);
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
              matches = event.source === playerAddress && isDamage(event);
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
        expectedDurationMs: 0,
        rawSkillId: rule.skillId,
        rawName:
          names.get(rule.skillId) ??
          (rule.skillId === MUSHROOM_KINGS_BLESSING_SKILL_ID
            ? MUSHROOM_KINGS_BLESSING_NAME
            : 'Unknown ' + rule.skillId),
        status: 'instant',
        eventIndex,
        evidence: rule.kind.startsWith('buff-') ? 'buff-transition' : rule.kind === 'missile' ? 'missile' : 'effect',
        eiRule: rule.rule,
        castOrigin: rule.origin ?? 'skill',
        metadataAccurate: !(rule.notAccurate || rule.kind.startsWith('effect') || rule.kind === 'damage'),
        // EI's synthetic negative IDs must resolve as attunements before a catalog can mistake -5 for Dodge.
        ...(rule.specialization === 'weaver' ? WEAVER_ATTUNEMENTS.get(rule.skillId) : undefined)
      });
    }
  }

  return actions;
}
