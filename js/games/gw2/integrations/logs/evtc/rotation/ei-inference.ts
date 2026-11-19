import { isBuffApply, isBuffRemoveAll } from '#gw2/integrations/logs/evtc/rotation/buff-events.js';
import { EI_INSTANT_RULES } from '#gw2/integrations/logs/evtc/rotation/ei-rules.js';
import { professionInstantCastEvents } from '#gw2/integrations/logs/evtc/rotation/professions/index.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import type { ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import {
  MUSHROOM_KINGS_BLESSING_NAME,
  MUSHROOM_KINGS_BLESSING_SKILL_ID
} from '#gw2/integrations/logs/shared/rotation/model.js';

/** EI's ordinary finders use specific evidence, half-open version ranges and a sliding duplicate window. */
export function eiInstantActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const { log, profile, playerAddress } = context;
  const evtcBuild = Number(log.header.arcdpsBuild);
  const gw2Build = Number(log.events.find((e) => e.stateChange === 15)?.source ?? 0n);
  const { owners, effects, hasEffects, names } = context.evidence;
  const species = new Map(
    log.agents.filter((a) => a.elite === 0xffffffff).map((a) => [a.address, a.profession & 0xffff])
  );
  const eventsBySkill = professionInstantCastEvents(context);

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
    const selfAppliedBuffs = rule.selfAppliedBuffs;
    const relatedEffectEnd = rule.relatedEffectEnd;
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
          // EngineerHelper.MineDetonationInstantCastChecker requires an actual dynamic end, never a nominal duration.
          (relatedEffectEnd == null ||
            effects.some(
              (other) =>
                relatedEffectEnd.guids.includes(other.guid) &&
                other.event.source === e.event.source &&
                other.dynamicEndTime != null &&
                Math.abs(other.dynamicEndTime - e.event.time) < 10
            ) === relatedEffectEnd.present) &&
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
          context.evidence
            .animationsFor(address)
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
              matches =
                isBuffApply(log, event) &&
                owns(event.target) &&
                (rule.appliedDuration == null || Math.abs(event.value - rule.appliedDuration) < 10) &&
                // EI's related-event checker counts self-applied BuffApplyEvents, including initial corroboration.
                (selfAppliedBuffs == null ||
                  (eventsBySkill.get(Number(rule.signal)) ?? []).filter(
                    ({ event: other }) =>
                      isBuffApply(log, other, true) &&
                      other.target === event.target &&
                      other.source === event.target &&
                      Math.abs(other.time - event.time) < 10 &&
                      Math.abs(other.value - selfAppliedBuffs.durationMs) < 10
                  ).length === selfAppliedBuffs.count);
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
          rule.name ??
          (rule.skillId === MUSHROOM_KINGS_BLESSING_SKILL_ID
            ? MUSHROOM_KINGS_BLESSING_NAME
            : 'Unknown ' + rule.skillId),
        status: 'instant',
        eventIndex,
        evidence: rule.kind.startsWith('buff-') ? 'buff-transition' : rule.kind === 'missile' ? 'missile' : 'effect',
        eiRule: rule.rule,
        castOrigin: rule.origin ?? 'skill',
        metadataAccurate: !(rule.notAccurate || rule.kind.startsWith('effect') || rule.kind === 'damage'),
        ...rule.actionIdentity
      });
    }
  }

  return actions;
}
