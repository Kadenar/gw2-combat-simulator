import type { Skill } from "../../../platform/engine/types.js";
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../types.js";
import { findRotationSkill } from "../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

/** Revenant-only legend, facet, warband, and split-animation reconstruction. */

interface RevenantActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

const SWAP_LEGENDS = Object.freeze({ name: "Swap Legends", skillId: -4 });
const ENCHANTED_DAGGERS = Object.freeze({
  name: "Enchanted Daggers",
  skillId: 26937,
});
const IMPOSSIBLE_ODDS = Object.freeze({
  name: "Impossible Odds",
  skillId: 27107,
});
const ORDERS_FROM_ABOVE = Object.freeze({
  name: "Orders from Above",
  skillId: 45537,
});
const SPIRITCRUSH = Object.freeze({ name: "Spiritcrush", skillId: 43993 });

const LEGEND_STANCE_NAME = /^Legendary .+ Stance$/;
const ENCHANTED_DAGGERS_BUFF = 28557;
const IMPOSSIBLE_ODDS_BUFF = 27581;
const ALACRITY_BUFF = 30328;
const SPIRITCRUSH_FIRST_HIT_DELAY_MS = 1320;
const SIGNAL_DEDUPLICATION_WINDOW_MS = 150;
const REDUCED_CAST_TOLERANCE_MS = 50;

const FACET_BUFF_ACTIONS = new Map<number, RevenantActionIdentity>([
  [27336, { name: "Facet of Light", skillId: 27220 }],
  [28036, { name: "Facet of Darkness", skillId: 28379 }],
  [28243, { name: "Facet of Elements", skillId: 27014 }],
  [27376, { name: "Facet of Strength", skillId: 26644 }],
  [27983, { name: "Facet of Chaos", skillId: 27760 }],
  [29275, { name: "Facet of Nature", skillId: 29371 }],
]);

const INITIAL_FACETS: readonly RevenantActionIdentity[] = Object.freeze([
  { name: "Facet of Light", skillId: 27220 },
  { name: "Facet of Darkness", skillId: 28379 },
  { name: "Facet of Elements", skillId: 27014 },
  { name: "Facet of Strength", skillId: 26644 },
  { name: "Facet of Chaos", skillId: 27760 },
  { name: "Facet of Nature", skillId: 29371 },
]);

const WARBAND_SPECIES_ACTIONS = new Map<number, RevenantActionIdentity>([
  [18524, { name: "Icerazor's Ire", skillId: 40485 }],
  [18791, { name: "Razorclaw's Rage", skillId: 42949 }],
  [18806, { name: "Breakrazor's Bastion", skillId: 45686 }],
  [18594, { name: "Darkrazor's Daring", skillId: 41220 }],
  [19002, { name: "Soulcleave's Summit", skillId: 45773 }],
]);

const WARBAND_ANIMATION_ACTIONS = new Map<number, RevenantActionIdentity>([
  [72353, { name: "Icerazor's Ire", skillId: 40485 }],
  [72370, { name: "Razorclaw's Rage", skillId: 42949 }],
  [72360, { name: "Darkrazor's Daring", skillId: 41220 }],
  [42614, { name: "Soulcleave's Summit", skillId: 45773 }],
]);

const TRUNCATED_PRECASTS = new Map<number, RevenantActionIdentity>([
  [28357, { name: "Searing Fissure", skillId: 28357 }],
  [28472, { name: "Shackling Wave", skillId: 28472 }],
  [41829, { name: "Sevenshot", skillId: 41829 }],
]);

const SPLIT_ANIMATION_PAIRS = new Map<number, number>([
  [27074, 28625],
  [62895, 62713],
]);

function rawSkillName(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
): string {
  return (
    context.log.skills.find((skill) => skill.id === skillId)?.name ||
    `Unknown ${skillId}`
  );
}

function skillFor(
  context: EvtcProfessionReconstructionContext,
  identity: RevenantActionIdentity,
): Skill | null {
  return findRotationSkill(
    identity.skillId,
    identity.name,
    context.catalog,
    context.profile,
  );
}

function runtimeDuration(
  context: EvtcProfessionReconstructionContext,
  identity: RevenantActionIdentity,
): number {
  const skill = skillFor(context, identity);
  return Math.max(
    0,
    Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
  );
}

function directAction(
  eventIndex: number,
  start: number,
  rawSkillId: number,
  rawName: string,
  identity: RevenantActionIdentity,
  evidence: EvtcRecordedRotationAction["evidence"] = "buff-transition",
  duration = 0,
): EvtcRecordedRotationAction {
  return {
    start,
    end: start + duration,
    expectedDuration: duration,
    rawSkillId,
    rawName,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name,
    evidence,
    status: duration > 0 ? "completed" : "instant",
    eventIndex,
  };
}

function playerInstance(
  context: EvtcProfessionReconstructionContext,
): number | null {
  return (
    context.log.events.find(
      (event) =>
        event.source === context.playerAddress && event.sourceInstance > 0,
    )?.sourceInstance ?? null
  );
}

function combatStart(
  context: EvtcProfessionReconstructionContext,
): number | null {
  return (
    context.log.events.find(
      (event) =>
        event.source === context.playerAddress &&
        event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT,
    )?.time ?? null
  );
}

function hasRecordedAction(
  actions: readonly EvtcRecordedRotationAction[],
  identity: RevenantActionIdentity,
  time: number,
  windowMs: number,
): boolean {
  return actions.some(
    (action) =>
      (action.rawSkillId === identity.skillId ||
        action.canonicalSkillId === identity.skillId ||
        action.rawName === identity.name ||
        action.canonicalName === identity.name) &&
      Math.abs(action.start - time) <= windowMs,
  );
}

function legendSwapActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      !LEGEND_STANCE_NAME.test(rawSkillName(context, event.skillId))
    ) {
      return [];
    }
    return [
      directAction(
        eventIndex,
        event.time,
        event.skillId,
        rawSkillName(context, event.skillId),
        SWAP_LEGENDS,
      ),
    ];
  });
}

function facetActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== "herald") return [];
  return context.log.events.flatMap((event, eventIndex) => {
    const identity = FACET_BUFF_ACTIONS.get(event.skillId);
    if (
      !identity ||
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY
    ) {
      return [];
    }
    return [
      directAction(
        eventIndex,
        event.time,
        event.skillId,
        rawSkillName(context, event.skillId),
        identity,
      ),
    ];
  });
}

function upkeepActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== IMPOSSIBLE_ODDS_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY
    ) {
      return [];
    }
    return [
      directAction(
        eventIndex,
        event.time,
        event.skillId,
        rawSkillName(context, event.skillId),
        IMPOSSIBLE_ODDS,
      ),
    ];
  });
}

function ordersFromAboveActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== "renegade") return [];
  const actions: EvtcRecordedRotationAction[] = [];
  let previousPulse: number | null = null;
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== ALACRITY_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY
    ) {
      return;
    }
    const beginsActivation =
      previousPulse == null || event.time - previousPulse > 1500;
    previousPulse = event.time;
    if (!beginsActivation) return;
    actions.push(
      directAction(
        eventIndex,
        event.time,
        event.skillId,
        rawSkillName(context, event.skillId),
        ORDERS_FROM_ABOVE,
      ),
    );
  });
  return actions;
}

function truncatedPrecastActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  if (atCombat == null) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    const identity = TRUNCATED_PRECASTS.get(event.skillId);
    if (
      !identity ||
      event.source !== context.playerAddress ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE &&
        event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }
    const start = event.time - event.value;
    if (
      start >= atCombat ||
      hasRecordedAction(
        context.recordedActions,
        identity,
        event.time,
        SIGNAL_DEDUPLICATION_WINDOW_MS,
      )
    ) {
      return [];
    }
    return [
      {
        ...directAction(
          eventIndex,
          start,
          event.skillId,
          rawSkillName(context, event.skillId),
          identity,
          "animation",
          event.value,
        ),
        expectedDuration: Math.max(event.value, event.buffDamage),
        precast: true,
      },
    ];
  });
}

function truncatedSpiritcrushActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== "herald") return [];
  const atCombat = combatStart(context);
  if (atCombat == null) return [];
  const firstSignal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === SPIRITCRUSH.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.buff === 0 &&
        event.value > 0 &&
        event.time <= atCombat + 2000,
    );
  if (!firstSignal) return [];
  const duration = runtimeDuration(context, SPIRITCRUSH);
  const end = firstSignal.event.time - SPIRITCRUSH_FIRST_HIT_DELAY_MS;
  const start = end - duration;
  if (
    start >= atCombat ||
    hasRecordedAction(
      actions,
      SPIRITCRUSH,
      start,
      SIGNAL_DEDUPLICATION_WINDOW_MS,
    )
  ) {
    return [];
  }
  return [
    {
      ...directAction(
        firstSignal.eventIndex,
        start,
        firstSignal.event.skillId,
        SPIRITCRUSH.name,
        SPIRITCRUSH,
        "initial-state",
        duration,
      ),
      precast: true,
    },
  ];
}

function initialFacetActions(
  context: EvtcProfessionReconstructionContext,
  anchor: number,
): EvtcRecordedRotationAction[] {
  if (
    context.profile.specializationId !== "herald" ||
    !Number.isFinite(anchor) ||
    !context.log.events.some(
      (event) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        rawSkillName(context, event.skillId) === "Legendary Dragon Stance",
    )
  ) {
    return [];
  }
  let cursor = anchor;
  const reversed: EvtcRecordedRotationAction[] = [];
  for (let index = INITIAL_FACETS.length - 1; index >= 0; index -= 1) {
    const identity = INITIAL_FACETS[index];
    const duration = runtimeDuration(context, identity);
    cursor -= duration;
    reversed.push({
      ...directAction(
        -5000 + index,
        cursor,
        identity.skillId,
        identity.name,
        identity,
        "initial-state",
        duration,
      ),
      precast: true,
    });
  }
  return reversed.reverse();
}

function initialWarbandActions(
  context: EvtcProfessionReconstructionContext,
  anchor: number,
): EvtcRecordedRotationAction[] {
  if (
    context.profile.specializationId !== "renegade" ||
    !Number.isFinite(anchor)
  ) {
    return [];
  }
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const initialAddresses = new Set(
    context.log.events
      .filter(
        (event) =>
          event.source !== context.playerAddress &&
          event.sourceMasterInstance === ownerInstance &&
          event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
      )
      .map((event) => event.source),
  );
  const identities = context.log.agents.flatMap((agent) => {
    if (!initialAddresses.has(agent.address)) return [];
    const identity = WARBAND_SPECIES_ACTIONS.get(agent.profession);
    return identity ? [identity] : [];
  });
  // The initial actor snapshot proves the summon completed before the first
  // retained cast. Preserve the short setup gap used by Revenant precasts so
  // energy regeneration and the following weapon cast remain executable.
  let cursor = anchor - 500;
  const reversed: EvtcRecordedRotationAction[] = [];
  for (let index = identities.length - 1; index >= 0; index -= 1) {
    const identity = identities[index];
    const duration = runtimeDuration(context, identity);
    cursor -= duration;
    reversed.push({
      ...directAction(
        -4000 + index,
        cursor,
        identity.skillId,
        identity.name,
        identity,
        "initial-state",
        duration,
      ),
      precast: true,
    });
  }
  return reversed.reverse();
}

function initialEnchantedDaggersActions(
  context: EvtcProfessionReconstructionContext,
  anchor: number,
): EvtcRecordedRotationAction[] {
  if (
    !Number.isFinite(anchor) ||
    !context.log.events.some(
      (event) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === ENCHANTED_DAGGERS_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
    )
  ) {
    return [];
  }
  const duration = runtimeDuration(context, ENCHANTED_DAGGERS);
  const actions: EvtcRecordedRotationAction[] = [
    {
      ...directAction(
        -6002,
        anchor - duration,
        ENCHANTED_DAGGERS_BUFF,
        ENCHANTED_DAGGERS.name,
        ENCHANTED_DAGGERS,
        "initial-state",
        duration,
      ),
      precast: true,
    },
  ];
  const initialStance = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      LEGEND_STANCE_NAME.test(rawSkillName(context, event.skillId)),
  );
  if (
    initialStance &&
    rawSkillName(context, initialStance.skillId) !== "Legendary Assassin Stance"
  ) {
    actions.push({
      ...directAction(
        -6001,
        anchor,
        0,
        SWAP_LEGENDS.name,
        SWAP_LEGENDS,
        "initial-state",
      ),
      precast: true,
    });
  }
  return actions;
}

function warbandActorActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== "renegade") return [];
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const legendSwaps = legendSwapActions(context);
  return context.log.events.flatMap((event, eventIndex) => {
    const identity = WARBAND_ANIMATION_ACTIONS.get(event.skillId);
    if (
      !identity ||
      event.sourceMasterInstance !== ownerInstance ||
      event.source === context.playerAddress ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_START ||
      actions.some(
        (action) =>
          (action.rawSkillId === identity.skillId ||
            action.canonicalSkillId === identity.skillId ||
            action.rawName === identity.name) &&
          action.start <= event.time &&
          event.time - action.start <= 1000,
      )
    ) {
      return [];
    }
    const swapsImmediatelyAfter = legendSwaps.some(
      (swap) => swap.start >= event.time && swap.start - event.time <= 250,
    );
    const start = event.time - (swapsImmediatelyAfter ? 200 : 0);
    return [
      directAction(
        eventIndex,
        start,
        event.skillId,
        rawSkillName(context, event.skillId),
        identity,
        "animation",
      ),
    ];
  });
}

function mergeSplitAnimations(
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
  const merged: EvtcRecordedRotationAction[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const action = sorted[index];
    const secondId = SPLIT_ANIMATION_PAIRS.get(action.rawSkillId);
    const second = sorted[index + 1];
    if (
      secondId != null &&
      second?.rawSkillId === secondId &&
      Math.abs(second.start - action.end) <= SIGNAL_DEDUPLICATION_WINDOW_MS
    ) {
      merged.push({
        ...action,
        end: Math.max(action.end, second.end),
        status:
          action.status === "unknown" || second.status === "unknown"
            ? "unknown"
            : "completed",
      });
      index += 1;
      continue;
    }
    merged.push(action);
  }
  return merged;
}

function cancelFireAtActionEnd(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction,
): boolean {
  return context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === action.rawSkillId &&
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
      event.activation === EVTC_ACTIVATION.CANCEL_FIRE &&
      Math.abs(event.time - action.end) <= SIGNAL_DEDUPLICATION_WINDOW_MS,
  );
}

function firstStrikeCommitMs(skill: Skill | null): number | null {
  const offsets = (skill?.effects || []).flatMap((effect) => {
    if (effect.type !== "strike") return [];
    const values = [
      Number(effect.atMs),
      ...(effect.ticks || []).map((tick) => Number(tick.atMs)),
    ].filter(Number.isFinite);
    return values;
  });
  return offsets.length ? Math.min(...offsets) : null;
}

function normalizeCastPackets(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const normalized: EvtcRecordedRotationAction[] = [];
  const absorbCanceledAnimation = (
    action: EvtcRecordedRotationAction,
  ): void => {
    let previousIndex = normalized.length - 1;
    while (
      previousIndex >= 0 &&
      normalized[previousIndex].end <= normalized[previousIndex].start
    ) {
      previousIndex -= 1;
    }
    if (previousIndex < 0) return;
    const previous = normalized[previousIndex];
    normalized[previousIndex] = {
      ...previous,
      end: Math.max(previous.end, action.end),
    };
  };

  for (const action of mergeSplitAnimations(actions)) {
    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      context.catalog,
      context.profile,
    );
    if (
      action.status === "interrupted" &&
      String(skill?.slot || "").toLowerCase() === "weapon_1"
    ) {
      absorbCanceledAnimation(action);
      continue;
    }
    const duration = Math.max(0, action.end - action.start);
    const expected = Math.max(
      0,
      Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
    );
    const autoattack = String(skill?.slot || "").toLowerCase() === "weapon_1";
    const strikeCommit = firstStrikeCommitMs(skill);
    if (
      autoattack &&
      strikeCommit != null &&
      duration < strikeCommit &&
      cancelFireAtActionEnd(context, action)
    ) {
      absorbCanceledAnimation(action);
      continue;
    }
    if (
      action.status === "completed" &&
      duration > 0 &&
      expected > 0 &&
      duration + REDUCED_CAST_TOLERANCE_MS < expected &&
      cancelFireAtActionEnd(context, action)
    ) {
      normalized.push({ ...action, status: "reduced" as const });
      continue;
    }
    normalized.push(action);
  }
  return normalized;
}

export function reconstructRevenantProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  const truncated = truncatedPrecastActions(context);
  const spiritcrush = truncatedSpiritcrushActions(context, [
    ...context.recordedActions,
    ...truncated,
  ]);
  const recoveredPrecasts = [...truncated, ...spiritcrush];
  const firstAnchor = Math.min(
    ...recoveredPrecasts.map((action) => action.start),
    ...context.recordedActions.map((action) => action.start),
    combatStart(context) ?? Number.POSITIVE_INFINITY,
  );
  const initialWarband = initialWarbandActions(context, firstAnchor);
  const warbandAnchor = Math.min(
    ...initialWarband.map((action) => action.start),
    firstAnchor,
  );
  const initialActions = [
    ...initialEnchantedDaggersActions(context, warbandAnchor),
    ...initialWarband,
    ...initialFacetActions(context, firstAnchor),
  ];
  const additions = [
    ...initialActions,
    ...recoveredPrecasts,
    ...legendSwapActions(context),
    ...facetActions(context),
    ...upkeepActions(context),
    ...ordersFromAboveActions(context),
  ];
  const withActors = [
    ...context.recordedActions,
    ...additions,
    ...warbandActorActions(context, [...context.recordedActions, ...additions]),
  ];
  return normalizeCastPackets(context, withActors);
}
