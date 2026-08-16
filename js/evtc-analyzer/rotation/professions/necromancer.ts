import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../types.js";
import { findRotationSkill } from "../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

/** Necromancer-only EVTC effect aliases and autoattack packet interpretation. */

const SUMMON_SPIRITS = Object.freeze({
  name: "Summon Spirits",
  skillId: 76607,
});
const INNERVATE_ANGUISH = Object.freeze({
  name: "Innervate Anguish",
  skillId: 77003,
});
const INNERVATE_WANDERLUST = Object.freeze({
  name: "Innervate Wanderlust",
  skillId: 76732,
});
const MANIFEST_SAND_SHADE = Object.freeze({
  name: "Manifest Sand Shade",
  skillId: 44946,
});
const NEFARIOUS_FAVOR = Object.freeze({
  name: "Nefarious Favor",
  skillId: 40813,
});
const SAND_CASCADE = Object.freeze({
  name: "Sand Cascade",
  skillId: 43448,
});
const GARISH_PILLAR = Object.freeze({
  name: "Garish Pillar",
  skillId: 44428,
});
const DESERT_SHROUD = Object.freeze({
  name: "Desert Shroud",
  skillId: 44663,
});
const BLOOD_IS_POWER = Object.freeze({
  name: "Blood Is Power",
  skillId: 10544,
});
const HAUNT = Object.freeze({ name: "Haunt", skillId: 10590 });
const GRASPING_DARKNESS = Object.freeze({
  name: "Grasping Darkness",
  skillId: 29740,
});
const NIGHTFALL = Object.freeze({ name: "Nightfall", skillId: 29855 });
const EXIT_REAPERS_SHROUD = Object.freeze({
  name: "Exit Reaper's Shroud",
  skillId: 30961,
});

// Summon Spirits has no cast event. Its active spirit attacks use these IDs;
// backdating by the mechanic's hit delay recovers the activation timestamp.
const SUMMON_SPIRITS_SIGNALS = new Map([
  [77860, 840],
  [78660, 360],
  [79246, 360],
]);
const INNERVATE_ANGUISH_SIGNAL = 77050;
const FEAR_BUFF = 791;
const SHADOW_FIEND_SPECIES_ID = 5673;
const HAUNT_ANIMATION_SIGNAL = 3643;
const SAND_SHADE_INITIAL_BUFF = 45079;
const NEFARIOUS_FAVOR_SIGNAL = 46808;
const DESERT_SHROUD_PULSE_SIGNAL = 46726;
const SUMMON_SPIRITS_SIGNAL_WINDOW_MS = 2500;
const INSTANT_SIGNAL_WINDOW_MS = 150;
const DESERT_SHROUD_PULSE_WINDOW_MS = 1500;
const GRASPING_DARKNESS_PRECAST_COMMIT_MS = 120;
const AUTOATTACK_CHAINS = Object.freeze([
  Object.freeze([
    Object.freeze({ name: "Dusk Strike", skillId: 29705 }),
    Object.freeze({ name: "Fading Twilight", skillId: 30799 }),
    Object.freeze({ name: "Chilling Scythe", skillId: 29867 }),
  ]),
  Object.freeze([
    Object.freeze({ name: "Dark Slash", skillId: 73012 }),
    Object.freeze({ name: "Deadly Slice", skillId: 73040 }),
    Object.freeze({ name: "Sinister Stab", skillId: 73047 }),
  ]),
]);

function effectAction(
  eventIndex: number,
  time: number,
  rawSkillId: number,
  rawName: string,
  canonical?: { readonly name: string; readonly skillId: number },
  evidence: EvtcRecordedRotationAction["evidence"] = "effect",
): EvtcRecordedRotationAction {
  return {
    start: time,
    end: time,
    expectedDuration: 0,
    rawSkillId,
    rawName,
    evidence,
    status: "instant",
    eventIndex,
    ...(canonical
      ? {
          canonicalSkillId: canonical.skillId,
          canonicalName: canonical.name,
        }
      : {}),
  };
}

function hasRecordedAction(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
  name: string,
  time: number,
  windowMs: number,
): boolean {
  const normalizedName = name.toLowerCase();
  return context.recordedActions.some(
    (action) =>
      (action.rawSkillId === skillId ||
        action.rawName.trim().toLowerCase() === normalizedName) &&
      Math.abs(action.start - time) <= windowMs,
  );
}

function summonSpiritsActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (event.source !== context.playerAddress) return;
    const delay = SUMMON_SPIRITS_SIGNALS.get(event.skillId);
    if (delay == null || event.buff !== 0) return;
    const start = event.time - delay;
    if (
      hasRecordedAction(
        context,
        SUMMON_SPIRITS.skillId,
        SUMMON_SPIRITS.name,
        start,
        INSTANT_SIGNAL_WINDOW_MS,
      ) ||
      actions.some(
        (action) =>
          Math.abs(action.start - start) <= SUMMON_SPIRITS_SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    actions.push(
      effectAction(eventIndex, start, event.skillId, SUMMON_SPIRITS.name),
    );
  });
  return actions;
}

function innervateAnguishActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== INNERVATE_ANGUISH_SIGNAL ||
      event.buff !== 0
    ) {
      return;
    }
    if (
      hasRecordedAction(
        context,
        INNERVATE_ANGUISH.skillId,
        INNERVATE_ANGUISH.name,
        event.time,
        INSTANT_SIGNAL_WINDOW_MS,
      ) ||
      actions.some(
        (action) =>
          Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    actions.push(
      effectAction(
        eventIndex,
        event.time,
        event.skillId,
        INNERVATE_ANGUISH.name,
      ),
    );
  });
  return actions;
}

function innervateWanderlustActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== FEAR_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      Math.max(event.value, event.buffDamage) !== 1500
    ) {
      return;
    }
    if (
      hasRecordedAction(
        context,
        INNERVATE_WANDERLUST.skillId,
        INNERVATE_WANDERLUST.name,
        event.time,
        INSTANT_SIGNAL_WINDOW_MS,
      ) ||
      actions.some(
        (action) =>
          Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    actions.push(
      effectAction(
        eventIndex,
        event.time,
        event.skillId,
        INNERVATE_WANDERLUST.name,
      ),
    );
  });
  return actions;
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

function recordedDuration(
  context: EvtcProfessionReconstructionContext,
  identity: { readonly name: string; readonly skillId: number },
): number {
  const normalizedName = identity.name.toLowerCase();
  const durations = context.recordedActions
    .filter(
      (action) =>
        action.status === "completed" &&
        action.end > action.start &&
        (action.rawSkillId === identity.skillId ||
          action.rawName.trim().toLowerCase() === normalizedName),
    )
    .map((action) => action.end - action.start)
    .sort((left, right) => left - right);
  if (durations.length) return durations[Math.floor(durations.length / 2)];
  const skill = findRotationSkill(
    identity.skillId,
    identity.name,
    context.catalog,
    context.profile,
  );
  return Math.max(
    0,
    Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
  );
}

function initialManifestSandShadeActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.target === context.playerAddress &&
        event.skillId === SAND_SHADE_INITIAL_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buffDamage > event.value,
    )
    .sort((left, right) => left.event.time - right.event.time)[0];
  if (!initial) return [];

  // BUFF_INITIAL stores the full and remaining shade lifetime. Their
  // difference is the age of the shade at the first EVTC snapshot.
  const start =
    initial.event.time - (initial.event.buffDamage - initial.event.value);
  if (
    hasRecordedAction(
      context,
      MANIFEST_SAND_SHADE.skillId,
      MANIFEST_SAND_SHADE.name,
      start,
      INSTANT_SIGNAL_WINDOW_MS,
    )
  ) {
    return [];
  }
  const duration = recordedDuration(context, MANIFEST_SAND_SHADE);
  return [
    {
      ...effectAction(
        initial.eventIndex,
        start,
        initial.event.skillId,
        MANIFEST_SAND_SHADE.name,
        MANIFEST_SAND_SHADE,
        "initial-state",
      ),
      end: start + duration,
      expectedDuration: duration,
      status: "completed",
      precast: true,
    },
  ];
}

function truncatedBloodIsPowerActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const firstPlayerEventTime = Math.min(
    ...context.log.events
      .filter(
        (event) =>
          event.time > 0 &&
          (event.source === context.playerAddress ||
            event.target === context.playerAddress),
      )
      .map((event) => event.time),
  );
  if (!Number.isFinite(firstPlayerEventTime)) return [];

  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== BLOOD_IS_POWER.skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE &&
        event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }
    const start = event.time - event.value;
    const alreadyRecorded = context.recordedActions.some(
      (action) =>
        action.rawSkillId === event.skillId &&
        Math.abs(action.end - event.time) <= INSTANT_SIGNAL_WINDOW_MS,
    );
    if (alreadyRecorded || start > firstPlayerEventTime) return [];
    return [
      {
        ...effectAction(
          eventIndex,
          start,
          event.skillId,
          BLOOD_IS_POWER.name,
          BLOOD_IS_POWER,
          "animation",
        ),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: "completed" as const,
        precast: true,
      },
    ];
  });
}

function hauntActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const shadowFiends = new Set(
    context.log.agents
      .filter((agent) => agent.profession === SHADOW_FIEND_SPECIES_ID)
      .map((agent) => agent.address),
  );
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      !shadowFiends.has(event.source) ||
      event.sourceMasterInstance !== ownerInstance ||
      event.skillId !== HAUNT_ANIMATION_SIGNAL ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_START
    ) {
      return [];
    }
    return [
      effectAction(
        eventIndex,
        event.time,
        event.skillId,
        HAUNT.name,
        HAUNT,
        "animation",
      ),
    ];
  });
}

function nefariousFavorActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== NEFARIOUS_FAVOR_SIGNAL ||
      event.buff !== 0 ||
      hasRecordedAction(
        context,
        NEFARIOUS_FAVOR.skillId,
        NEFARIOUS_FAVOR.name,
        event.time,
        INSTANT_SIGNAL_WINDOW_MS,
      ) ||
      actions.some(
        (action) =>
          Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    actions.push(
      effectAction(
        eventIndex,
        event.time,
        event.skillId,
        NEFARIOUS_FAVOR.name,
        NEFARIOUS_FAVOR,
      ),
    );
  });
  return actions;
}

function desertShroudActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  let previousPulse: number | null = null;
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== DESERT_SHROUD_PULSE_SIGNAL ||
      event.buff !== 0
    ) {
      return;
    }
    const beginsActivation =
      previousPulse == null ||
      event.time - previousPulse > DESERT_SHROUD_PULSE_WINDOW_MS;
    previousPulse = event.time;
    if (!beginsActivation) return;
    actions.push(
      effectAction(
        eventIndex,
        event.time,
        event.skillId,
        DESERT_SHROUD.name,
        DESERT_SHROUD,
      ),
    );
  });
  return actions;
}

function sandCascadeActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== SAND_CASCADE.skillId ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START ||
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.value <= 0 &&
        event.buffDamage <= 0) ||
      hasRecordedAction(
        context,
        SAND_CASCADE.skillId,
        SAND_CASCADE.name,
        event.time,
        INSTANT_SIGNAL_WINDOW_MS,
      ) ||
      actions.some(
        (action) =>
          Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    actions.push(
      effectAction(
        eventIndex,
        event.time,
        event.skillId,
        SAND_CASCADE.name,
        SAND_CASCADE,
      ),
    );
  });
  return actions;
}

function garishPillarActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== FEAR_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      Math.max(event.value, event.buffDamage) !== 1000 ||
      hasRecordedAction(
        context,
        GARISH_PILLAR.skillId,
        GARISH_PILLAR.name,
        event.time,
        INSTANT_SIGNAL_WINDOW_MS,
      ) ||
      actions.some(
        (action) =>
          Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    actions.push(
      effectAction(
        eventIndex,
        event.time,
        event.skillId,
        GARISH_PILLAR.name,
        GARISH_PILLAR,
      ),
    );
  });
  return actions;
}

function scourgeActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  return [
    ...initialManifestSandShadeActions(context),
    ...truncatedBloodIsPowerActions(context),
    ...hauntActions(context),
    ...nefariousFavorActions(context),
    ...sandCascadeActions(context),
    ...garishPillarActions(context),
    ...desertShroudActions(context),
  ];
}

function truncatedReaperPrecastActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const firstPlayerEventTime = Math.min(
    ...context.log.events
      .filter(
        (event) =>
          event.time > 0 &&
          (event.source === context.playerAddress ||
            event.target === context.playerAddress),
      )
      .map((event) => event.time),
  );
  if (!Number.isFinite(firstPlayerEventTime)) return [];

  const nightfallStop = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === NIGHTFALL.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
        (event.activation === EVTC_ACTIVATION.CANCEL_FIRE ||
          event.activation === EVTC_ACTIVATION.RESET) &&
        event.value > 0,
    )
    .sort((left, right) => left.event.time - right.event.time)[0];
  if (!nightfallStop) return [];
  const nightfallStart = nightfallStop.event.time - nightfallStop.event.value;
  const nightfallRecorded = context.recordedActions.some(
    (action) =>
      action.rawSkillId === NIGHTFALL.skillId &&
      Math.abs(action.end - nightfallStop.event.time) <=
        INSTANT_SIGNAL_WINDOW_MS,
  );
  if (nightfallRecorded || nightfallStart > firstPlayerEventTime) return [];

  const actions: EvtcRecordedRotationAction[] = [
    {
      ...effectAction(
        nightfallStop.eventIndex,
        nightfallStart,
        nightfallStop.event.skillId,
        NIGHTFALL.name,
        NIGHTFALL,
        "animation",
      ),
      end: nightfallStop.event.time,
      expectedDuration: Math.max(
        nightfallStop.event.value,
        nightfallStop.event.buffDamage,
      ),
      status: "completed",
      precast: true,
    },
  ];

  const graspingSignal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === GRASPING_DARKNESS.skillId &&
        event.time <= nightfallStop.event.time &&
        event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_START &&
        event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP,
    )
    .sort((left, right) => left.event.time - right.event.time)[0];
  if (!graspingSignal) return actions;
  const graspingStart = nightfallStart - GRASPING_DARKNESS_PRECAST_COMMIT_MS;
  if (
    hasRecordedAction(
      context,
      GRASPING_DARKNESS.skillId,
      GRASPING_DARKNESS.name,
      graspingStart,
      INSTANT_SIGNAL_WINDOW_MS,
    )
  ) {
    return actions;
  }
  const graspingSkill = findRotationSkill(
    GRASPING_DARKNESS.skillId,
    GRASPING_DARKNESS.name,
    context.catalog,
    context.profile,
  );
  actions.push({
    ...effectAction(
      graspingSignal.eventIndex,
      graspingStart,
      graspingSignal.event.skillId,
      GRASPING_DARKNESS.name,
      GRASPING_DARKNESS,
    ),
    end: nightfallStart,
    expectedDuration: Math.max(
      GRASPING_DARKNESS_PRECAST_COMMIT_MS,
      Number(
        graspingSkill?.quicknessCastTimeMs || graspingSkill?.castTimeMs || 0,
      ),
    ),
    status: "interrupted",
    precast: true,
  });
  return actions;
}

function encounterEndTime(
  context: EvtcProfessionReconstructionContext,
): number | null {
  const targets = new Set(
    context.log.agents
      .filter((agent) => agent.profession === context.log.header.encounterId)
      .map((agent) => agent.address),
  );
  const times = context.log.events
    .filter(
      (event) =>
        targets.has(event.source) &&
        (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT ||
          event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD),
    )
    .map((event) => event.time);
  return times.length ? Math.min(...times) : null;
}

function removePostEncounterReaperExit(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context);
  if (encounterEnd == null) return [...actions];
  return actions.filter(
    (action) =>
      !(
        (action.rawSkillId === EXIT_REAPERS_SHROUD.skillId ||
          action.rawName === EXIT_REAPERS_SHROUD.name) &&
        action.start > encounterEnd
      ),
  );
}

function resetsAutoattackChain(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction,
): boolean {
  const skill = findRotationSkill(
    action.rawSkillId,
    action.rawName,
    context.catalog,
    context.profile,
  );
  return (
    skill?.type === "Weapon" ||
    Number(skill?.castTimeMs || 0) > 0 ||
    Boolean(skill?.shroud) ||
    skill?.handlerId === "necromancer.shroud" ||
    action.rawName === "Swap Weapons"
  );
}

function isWeaponAutoattack(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction,
): boolean {
  const skill = findRotationSkill(
    action.rawSkillId,
    action.rawName,
    context.catalog,
    context.profile,
  );
  return String(skill?.slot || "").toLowerCase() === "weapon_1";
}

function normalizeAutoattackChains(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  // Arc can repeat a spear root ID for later chain steps and can report a
  // canceled greatsword child after the chain reset. Keep rawSkillId intact,
  // but choose the executable action from the reconstructed chain state.
  const positions = new Map<
    number,
    { readonly chainIndex: number; readonly actionIndex: number }
  >();
  AUTOATTACK_CHAINS.forEach((chain, chainIndex) => {
    chain.forEach((identity, actionIndex) => {
      positions.set(identity.skillId, { chainIndex, actionIndex });
    });
  });

  let activeChainIndex: number | null = null;
  let expectedActionIndex = 0;
  return [...actions]
    .sort(
      (left, right) =>
        left.start - right.start || left.eventIndex - right.eventIndex,
    )
    .flatMap((action) => {
      const position = positions.get(action.rawSkillId);
      if (
        action.status === "interrupted" &&
        (position != null || isWeaponAutoattack(context, action))
      ) {
        // Arc records canceled auto packets as casts even though no strike
        // completed. Replaying them reserves time and advances the simulator
        // away from the rotation that actually executed.
        activeChainIndex = null;
        expectedActionIndex = 0;
        return [];
      }
      if (!position) {
        if (resetsAutoattackChain(context, action)) {
          activeChainIndex = null;
          expectedActionIndex = 0;
        }
        return [action];
      }

      const actionIndex =
        activeChainIndex === position.chainIndex ? expectedActionIndex : 0;
      const chain = AUTOATTACK_CHAINS[position.chainIndex];
      const identity = chain[actionIndex];
      const normalized = {
        ...action,
        canonicalSkillId: identity.skillId,
        canonicalName: identity.name,
      };
      if (action.status === "completed" && actionIndex < chain.length - 1) {
        activeChainIndex = position.chainIndex;
        expectedActionIndex = actionIndex + 1;
      } else {
        activeChainIndex = null;
        expectedActionIndex = 0;
      }
      return [normalized];
    });
}

export function reconstructNecromancerProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  let additions: EvtcRecordedRotationAction[] = [];
  if (context.profile.specializationId === "reaper") {
    additions = truncatedReaperPrecastActions(context);
  } else if (context.profile.specializationId === "ritualist") {
    additions = [
      ...summonSpiritsActions(context),
      ...innervateAnguishActions(context),
      ...innervateWanderlustActions(context),
    ];
  } else if (context.profile.specializationId === "scourge") {
    additions = scourgeActions(context);
  }
  const actions = [...context.recordedActions, ...additions];
  return normalizeAutoattackChains(
    context,
    context.profile.specializationId === "reaper"
      ? removePostEncounterReaperExit(context, actions)
      : actions,
  );
}
