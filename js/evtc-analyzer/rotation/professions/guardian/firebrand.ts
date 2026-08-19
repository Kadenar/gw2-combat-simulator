import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { canonicalAction, type GuardianActionIdentity, isPhysicalWeaponSwap, SWAP_WEAPONS } from './shared.js';

const TOME_OF_JUSTICE = Object.freeze({
  name: 'Tome of Justice',
  skillId: 44364
});
const TOME_OF_RESOLVE = Object.freeze({
  name: 'Tome of Resolve',
  skillId: 41780
});
const TOME_OF_COURAGE = Object.freeze({
  name: 'Tome of Courage',
  skillId: 42259
});
const STOW_TOME = Object.freeze({ name: 'Stow Tome', skillId: 41380 });
const RESTORING_REPRIEVE = Object.freeze({
  name: 'Restoring Reprieve',
  skillId: 41475
});
const REJUVENATING_RESPITE = Object.freeze({
  name: 'Rejuvenating Respite',
  skillId: 42960
});
const FLAME_RUSH = Object.freeze({ name: 'Flame Rush', skillId: 45082 });
const FLAME_SURGE = Object.freeze({ name: 'Flame Surge', skillId: 42924 });

const FIREBRAND_TOME_SET = 2;
const PROTECTION_BUFF = 717;
const RESOLUTION_BUFF = 873;
const AEGIS_BUFF = 743;

const FIREBRAND_TOME_CHAPTERS = new Map<number, GuardianActionIdentity>([
  [41258, TOME_OF_JUSTICE],
  [40635, TOME_OF_JUSTICE],
  [42449, TOME_OF_JUSTICE],
  [40015, TOME_OF_JUSTICE],
  [42898, TOME_OF_JUSTICE],
  [45022, TOME_OF_RESOLVE],
  [40679, TOME_OF_RESOLVE],
  [45128, TOME_OF_RESOLVE],
  [42008, TOME_OF_RESOLVE],
  [42925, TOME_OF_RESOLVE],
  [42986, TOME_OF_COURAGE],
  [41968, TOME_OF_COURAGE],
  [41836, TOME_OF_COURAGE],
  [40988, TOME_OF_COURAGE],
  [44455, TOME_OF_COURAGE]
]);

const FIREBRAND_TOME_ACTION_IDS = new Set<number>([
  TOME_OF_JUSTICE.skillId,
  TOME_OF_RESOLVE.skillId,
  TOME_OF_COURAGE.skillId
]);
const FIREBRAND_TOME_IDS = new Set<number>(FIREBRAND_TOME_ACTION_IDS);
const TWO_PAGE_CHAPTER_IDS = new Set<number>([42925, 44455]);
const FINAL_MANTRA_CHARGE_IDS = new Set<number>([41328, 42924, 42960]);
const ARCHIVIST_OF_WHISPERS = 2086;
const WEIGHTY_TERMS = 2063;
const LOREMASTER = 2159;

interface FirebrandTomeResourceEvent {
  readonly action: EvtcRecordedRotationAction;
  readonly at: number;
  readonly kind: 'open' | 'page' | 'page-gain' | 'stow';
  readonly tomeId: number | null;
}

export function isFirebrandTomeActionId(skillId: number): boolean {
  return FIREBRAND_TOME_ACTION_IDS.has(skillId);
}

function tomeIdentityBetween(
  actions: readonly EvtcRecordedRotationAction[],
  start: number,
  end: number
): GuardianActionIdentity | null {
  for (const action of actions) {
    if (action.start < start || action.start >= end) continue;
    const identity = FIREBRAND_TOME_CHAPTERS.get(action.rawSkillId);
    if (identity) return identity;
  }

  return null;
}

function actionSkillId(action: EvtcRecordedRotationAction): number {
  return Number(action.canonicalSkillId ?? action.rawSkillId);
}

function tomePageCost(context: EvtcProfessionReconstructionContext, action: EvtcRecordedRotationAction): number {
  const skillId = actionSkillId(action);
  const skill = context.catalog?.skills.find((candidate) => Number(candidate.id) === skillId);
  const configured = Number(skill?.pageCost);
  return Number.isFinite(configured) && configured > 0 ? configured : TWO_PAGE_CHAPTER_IDS.has(skillId) ? 2 : 1;
}

function firebrandResourceEvents(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): FirebrandTomeResourceEvent[] {
  return actions
    .flatMap((action): FirebrandTomeResourceEvent[] => {
      const skillId = actionSkillId(action);
      if (FIREBRAND_TOME_IDS.has(skillId)) {
        return [{ action, at: action.start, kind: 'open', tomeId: skillId }];
      }

      const chapterTome = FIREBRAND_TOME_CHAPTERS.get(skillId);
      if (chapterTome && action.status !== 'interrupted') {
        return [
          {
            action,
            at: action.end,
            kind: 'page',
            tomeId: chapterTome.skillId
          }
        ];
      }

      if (skillId === STOW_TOME.skillId) {
        return [{ action, at: action.start, kind: 'stow', tomeId: null }];
      }

      const skill = context.catalog?.skills.find((candidate) => Number(candidate.id) === skillId);
      if (FINAL_MANTRA_CHARGE_IDS.has(skillId) || /^Final Charge\./.test(String(skill?.description || ''))) {
        return [{ action, at: action.end, kind: 'page-gain', tomeId: null }];
      }

      return [];
    })
    .sort(
      (left, right) =>
        left.at - right.at ||
        Number(left.kind === 'stow') - Number(right.kind === 'stow') ||
        left.action.eventIndex - right.action.eventIndex
    );
}

function omitAutomaticTomeStows(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const config = context.professionConfig || {};
  const selectedTraits = new Set((Array.isArray(config.selectedTraitIds) ? config.selectedTraitIds : []).map(Number));
  const maximumPages = selectedTraits.has(ARCHIVIST_OF_WHISPERS) ? 8 : 5;
  const configuredInitialPages = Number(config.initialTomePages ?? maximumPages);
  const normalizedInitialPages = Number.isFinite(configuredInitialPages) ? configuredInitialPages : maximumPages;
  const initialPages =
    selectedTraits.has(ARCHIVIST_OF_WHISPERS) && normalizedInitialPages === 5 ? maximumPages : normalizedInitialPages;
  let pages = Math.max(0, Math.min(maximumPages, initialPages));
  const pageInterval = selectedTraits.has(LOREMASTER) ? 5_000 : 8_000;
  const timelineOriginMs = Math.min(context.timelineOriginMs, ...actions.map((action) => action.start));
  let nextPageAt = pages < maximumPages ? timelineOriginMs + pageInterval : Number.POSITIVE_INFINITY;
  let activeTomeId: number | null = null;
  let swiftScholarTomeId: number | null = null;
  let swiftScholarCount = 0;
  let automaticStowPending = false;
  const omitted = new Set<EvtcRecordedRotationAction>();

  const regeneratePages = (at: number): void => {
    while (pages < maximumPages && nextPageAt <= at) {
      pages += 1;
      nextPageAt = pages >= maximumPages ? Number.POSITIVE_INFINITY : nextPageAt + pageInterval;
    }
  };

  // Replay page costs, regeneration, and trait gains at EVTC timestamps so only
  // involuntary weapon-set exits become implicit; genuine stows remain actions.
  for (const event of firebrandResourceEvents(context, actions)) {
    regeneratePages(event.at);
    if (event.kind === 'open') {
      activeTomeId = event.tomeId;
      automaticStowPending = false;
      if (swiftScholarTomeId !== event.tomeId) {
        swiftScholarTomeId = event.tomeId;
        swiftScholarCount = 0;
      }

      continue;
    }

    if (event.kind === 'page') {
      if (pages >= maximumPages) nextPageAt = event.at + pageInterval;
      pages = Math.max(0, pages - tomePageCost(context, event.action));
      if (swiftScholarTomeId !== event.tomeId) {
        swiftScholarTomeId = event.tomeId;
        swiftScholarCount = 0;
      }

      swiftScholarCount += 1;
      if (swiftScholarCount >= 3) {
        swiftScholarCount = 0;
        pages = Math.min(maximumPages, pages + 1);
        if (pages >= maximumPages) nextPageAt = Number.POSITIVE_INFINITY;
      }

      if (pages === 0) {
        activeTomeId = null;
        automaticStowPending = true;
      }

      continue;
    }

    if (event.kind === 'page-gain') {
      if (selectedTraits.has(WEIGHTY_TERMS)) {
        pages = Math.min(maximumPages, pages + 2);
        if (pages >= maximumPages) nextPageAt = Number.POSITIVE_INFINITY;
      }

      continue;
    }

    if (automaticStowPending && activeTomeId === null) {
      omitted.add(event.action);
      automaticStowPending = false;
      continue;
    }

    activeTomeId = null;
    swiftScholarTomeId = null;
    swiftScholarCount = 0;
    automaticStowPending = false;
  }

  return actions.filter((action) => !omitted.has(action));
}

export function normalizeFirebrandWeaponTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const swaps = actions
    .filter((action) => action.rawName === SWAP_WEAPONS.name)
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const tomes = new Map<
    number,
    {
      readonly identity: GuardianActionIdentity;
      readonly exitEventIndex: number;
    }
  >();
  for (const entry of swaps) {
    const event = context.log.events[entry.eventIndex];
    if (Number(event?.target) !== FIREBRAND_TOME_SET) continue;
    const exit = swaps.find(
      (candidate) =>
        candidate.start >= entry.start && Number(context.log.events[candidate.eventIndex]?.value) === FIREBRAND_TOME_SET
    );
    if (!exit) continue;
    const identity = tomeIdentityBetween(actions, entry.start, exit.start);
    if (!identity) continue;
    tomes.set(entry.eventIndex, {
      identity,
      exitEventIndex: exit.eventIndex
    });
  }

  const exits = new Map([...tomes.values()].map(({ identity, exitEventIndex }) => [exitEventIndex, identity]));

  const normalized = actions.flatMap((action) => {
    if (action.rawName !== SWAP_WEAPONS.name) return [action];
    const event = context.log.events[action.eventIndex];
    if (!event) return [];
    if (isPhysicalWeaponSwap(context, action)) return [action];
    const tome = tomes.get(action.eventIndex);
    if (tome) {
      return [
        {
          ...canonicalAction(action.eventIndex, action.start, tome.identity, action.rawSkillId),
          weaponSet: action.weaponSet
        }
      ];
    }

    if (exits.has(action.eventIndex)) {
      return [
        {
          ...canonicalAction(action.eventIndex, action.start, STOW_TOME, action.rawSkillId),
          weaponSet: action.weaponSet
        }
      ];
    }

    return [];
  });
  return normalized;
}

function inferFirebrandDamageInstants(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    const identity =
      event.skillId === FLAME_RUSH.skillId ? FLAME_RUSH : event.skillId === FLAME_SURGE.skillId ? FLAME_SURGE : null;
    if (
      !identity ||
      event.source !== context.playerAddress ||
      event.buff !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.value <= 0
    ) {
      return [];
    }

    return [canonicalAction(eventIndex, event.time, identity, event.skillId)];
  });
}

function inferFirebrandHealMantras(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const byTimestamp = new Map<
    number,
    Array<{
      readonly event: EvtcProfessionReconstructionContext['log']['events'][number];
      readonly eventIndex: number;
    }>
  >();
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      ![PROTECTION_BUFF, RESOLUTION_BUFF, AEGIS_BUFF].includes(event.skillId) ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      event.value <= 0
    ) {
      return;
    }

    const nearbyTimestamp = [...byTimestamp.keys()].find((timestamp) => Math.abs(timestamp - event.time) <= 5);
    const timestamp = nearbyTimestamp ?? event.time;
    byTimestamp.set(timestamp, [...(byTimestamp.get(timestamp) || []), { event, eventIndex }]);
  });

  const inferred: EvtcRecordedRotationAction[] = [];
  for (const [timestamp, signals] of byTimestamp) {
    const ids = new Set(signals.map(({ event }) => event.skillId));
    if (!ids.has(PROTECTION_BUFF) || !ids.has(RESOLUTION_BUFF)) continue;
    const recipients = new Set(signals.map(({ event }) => event.target));
    if (recipients.size < 2 && context.log.agents.length > 1) continue;
    const identity = ids.has(AEGIS_BUFF) ? REJUVENATING_RESPITE : RESTORING_REPRIEVE;
    inferred.push(canonicalAction(signals[0].eventIndex, timestamp, identity, signals[0].event.skillId));
  }

  return inferred;
}

export function reconstructFirebrandActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return omitAutomaticTomeStows(context, [
    ...actions,
    ...inferFirebrandDamageInstants(context),
    ...inferFirebrandHealMantras(context)
  ]);
}
