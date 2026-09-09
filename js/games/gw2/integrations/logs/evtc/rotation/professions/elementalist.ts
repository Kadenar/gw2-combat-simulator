import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import {
  createStrikePacketMatcher,
  quicknessRuntimeDurationMs,
  skillForAction
} from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { reconstructEvokerActions } from '#gw2/integrations/logs/evtc/rotation/professions/elementalist/evoker.js';
import { instantAction, playerInstance } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

const ELEMENTAL_COMMANDS = Object.freeze([
  {
    speciesId: 6524,
    character: 'Fire Elemental',
    action: { name: 'Flame Barrage', skillId: 2662 }
  },
  {
    speciesId: 6523,
    character: 'Earth Elemental',
    action: { name: 'Stomp', skillId: 2666 }
  }
]);

type ElementalistActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
) => EvtcRecordedRotationAction[];

const specializationAnalyzers: ReadonlyMap<string, ElementalistActionTransform> = new Map([
  ['evoker', reconstructEvokerActions]
]);
const HURL_PACKET_GROUP_MS = 1000;
const FIRE_AURA_BUFF_ID = 5677;
const FROST_AURA_BUFF_ID = 5579;
const FROST_AURA_DURATION_MS = 10_000;
const BLINDED_BUFF_ID = 720;
const AURA_SIGNAL_WINDOW_MS = 150;
// Pistol-generated auras can enable Transmute Fire without a separate Fire Shield input.
const FIRE_AURA_SOURCES = new Set([
  'Feel the Burn!',
  'Signet of Fire',
  'Conflagration',
  'Overload Fire',
  'Elemental Explosion',
  'Searing Salvo',
  'Frostfire Flurry'
]);
const ELEMENTALIST_ATTUNEMENTS = Object.freeze(['Fire', 'Water', 'Air', 'Earth']);

function isAction(action: EvtcRecordedRotationAction, skillId: number): boolean {
  return action.rawSkillId === skillId || action.canonicalSkillId === skillId;
}

function actionName(action: EvtcRecordedRotationAction): string {
  return action.canonicalName || action.rawName;
}

function configuredStartingAttunement(context: EvtcProfessionReconstructionContext): string {
  const configured = String(context.professionConfig?.startAttunement || '')
    .trim()
    .toLowerCase();
  return ELEMENTALIST_ATTUNEMENTS.find((attunement) => attunement.toLowerCase() === configured) || 'Fire';
}

function isAnimationStart(event: ParsedEvtcEvent): boolean {
  return (
    event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START ||
    (event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS))
  );
}

function ownedElementalCommandActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  return ELEMENTAL_COMMANDS.flatMap(({ speciesId, character, action }) => {
    const actors = new Set(
      context.log.agents
        .filter((agent) => agent.profession === speciesId || agent.character === character)
        .map((agent) => agent.address)
    );

    return context.log.events.flatMap((event, eventIndex) => {
      if (
        !actors.has(event.source) ||
        event.sourceMasterInstance !== ownerInstance ||
        event.skillId !== action.skillId ||
        !isAnimationStart(event)
      ) {
        return [];
      }

      // Owned animation starts are direct log evidence of player-issued elemental commands.
      return [
        {
          start: event.time,
          end: event.time,
          expectedDuration: 0,
          rawSkillId: event.skillId,
          rawName: action.name,
          canonicalSkillId: action.skillId,
          canonicalName: action.name,
          evidence:
            event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START
              ? ('animation' as const)
              : ('legacy-activation' as const),
          status: 'instant' as const,
          eventIndex
        }
      ];
    });
  });
}

function collapsedHurlActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  if (actions.some((action) => isAction(action, ID.HURL))) return [];
  const packets = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === ID.HURL &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.buff === 0 &&
        event.value > 0
    )
    .sort((left, right) => left.event.time - right.event.time || left.eventIndex - right.eventIndex);
  const actionsFromPackets: EvtcRecordedRotationAction[] = [];
  let groupStart: number | null = null;
  for (const packet of packets) {
    if (groupStart != null && packet.event.time - groupStart <= HURL_PACKET_GROUP_MS) continue;
    groupStart = packet.event.time;
    // One Hurl input produces a short burst of projectile packets; keep only the first packet as timing evidence.
    actionsFromPackets.push({
      start: packet.event.time,
      end: packet.event.time,
      expectedDuration: 0,
      rawSkillId: ID.HURL,
      rawName: 'Hurl',
      canonicalSkillId: ID.HURL,
      canonicalName: 'Hurl',
      evidence: 'effect',
      status: 'instant',
      eventIndex: packet.eventIndex
    });
  }

  return actionsFromPackets;
}

function inferArcLightningChannelDurations(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const validatePackets = createStrikePacketMatcher(context);
  const arcTargets = new Set(
    context.log.events
      .filter(
        (event) =>
          event.source === context.playerAddress &&
          event.skillId === ID.ARC_LIGHTNING &&
          event.activation === EVTC_ACTIVATION.NONE &&
          event.stateChange === EVTC_STATE_CHANGE.NONE &&
          event.buff === 0 &&
          event.value > 0 &&
          event.target !== 0n
      )
      .map((event) => event.target)
  );
  const targetEndTimes = context.log.events
    .filter(
      (event) =>
        arcTargets.has(event.source) &&
        (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT || event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD)
    )
    .map((event) => event.time)
    .sort((left, right) => left - right);
  return actions.map((action) => {
    if (!isAction(action, ID.ARC_LIGHTNING)) return action;
    const packets = validatePackets(action);
    const actualDuration = Math.max(0, action.end - action.start);
    const runtimeDuration = quicknessRuntimeDurationMs(skillForAction(context, action));
    if (action.status === 'unknown' && !packets.anyObserved) {
      const targetEnd = targetEndTimes.find((time) => time >= action.start);
      const targetEndDuration = targetEnd == null ? null : targetEnd - action.start;
      if (targetEndDuration != null && targetEndDuration >= 0 && targetEndDuration + 10 < runtimeDuration) {
        // A log-edge channel has no stop packet after the target dies; use that target-state
        // packet as the channel boundary so replay cannot invent post-fight Arc Lightning ticks.
        return {
          ...action,
          end: action.start + targetEndDuration,
          status: 'reduced',
          replayInterruptMs: targetEndDuration
        };
      }
    }

    if (action.status !== 'completed') return action;
    const packetBoundaryProvesInterruption =
      packets.anyObserved &&
      !packets.allObserved &&
      packets.lastObservedOffsetMs != null &&
      packets.firstMissingOffsetMs != null &&
      packets.firstMissingOffsetMs > packets.lastObservedOffsetMs &&
      actualDuration + 80 >= packets.lastObservedOffsetMs &&
      actualDuration < packets.firstMissingOffsetMs &&
      actualDuration + 10 < runtimeDuration;
    if (!packetBoundaryProvesInterruption) return action;
    // ArcDPS reports a fired channel as completed even when it ends between damage packets;
    // replay only through the observed packet boundary so omitted ticks are not regenerated.
    return {
      ...action,
      status: 'reduced',
      replayInterruptMs: actualDuration
    };
  });
}

function filterUncommittedFlamestrikes(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const validatePackets = createStrikePacketMatcher(context);
  return actions.filter((action) => {
    if (!isAction(action, ID.FLAMESTRIKE)) return true;
    const packets = validatePackets(action);
    // Autoattack activation packets are emitted even when Flamestrike is cancelled before impact;
    // retain the input only when the catalog can verify at least one resulting damage packet.
    return packets.expectedCount === 0 || packets.anyObserved;
  });
}

function recoverMissingFireShieldActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const skill = findRotationSkill(ID.FIRE_SHIELD, 'Fire Shield', context.catalog, context.profile);
  if (!skill) return [...actions];
  const hasFocus =
    String(context.professionConfig?.secondaryWeapon || '')
      .trim()
      .toLowerCase() === 'focus' || actions.some((action) => isAction(action, ID.TRANSMUTE_FIRE));
  if (!hasFocus) return [...actions];

  const recovered = context.log.events.flatMap<EvtcRecordedRotationAction>((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== FIRE_AURA_BUFF_ID ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      Math.max(event.value, event.buffDamage) <= 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY)
    ) {
      return [];
    }

    const alreadyRecorded = actions.some(
      (action) => isAction(action, ID.FIRE_SHIELD) && Math.abs(action.start - event.time) <= AURA_SIGNAL_WINDOW_MS
    );
    const explainedBySource = actions.some((action) => {
      if (actionName(action) === 'Fire Attunement') {
        return Math.abs(action.start - event.time) <= AURA_SIGNAL_WINDOW_MS;
      }

      return (
        FIRE_AURA_SOURCES.has(actionName(action)) &&
        event.time >= action.start - AURA_SIGNAL_WINDOW_MS &&
        event.time <= action.end + AURA_SIGNAL_WINDOW_MS
      );
    });
    if (alreadyRecorded || explainedBySource) return [];

    // Once Focus is established, recover unexplained self-auras even when the
    // player never transmutes them; Fire Shield still grants familiar charges.
    return [
      {
        start: event.time,
        end: event.time,
        expectedDuration: 0,
        rawSkillId: ID.FIRE_SHIELD,
        rawName: 'Fire Shield',
        canonicalSkillId: ID.FIRE_SHIELD,
        canonicalName: 'Fire Shield',
        evidence: 'buff-transition' as const,
        status: 'instant' as const,
        eventIndex
      }
    ];
  });

  return [...actions, ...recovered];
}

function recoverMissingFrostAuraActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const skill = findRotationSkill(ID.FROST_AURA, 'Frost Aura', context.catalog, context.profile);
  if (!skill) return [...actions];
  const hasDagger =
    String(context.professionConfig?.secondaryWeapon || '')
      .trim()
      .toLowerCase() === 'dagger' || actions.some((action) => isAction(action, ID.TRANSMUTE_FROST));
  if (!hasDagger) return [...actions];

  const recovered = context.log.events.flatMap<EvtcRecordedRotationAction>((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== FROST_AURA_BUFF_ID ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      Math.max(event.value, event.buffDamage) !== FROST_AURA_DURATION_MS ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY) ||
      actions.some(
        (action) => isAction(action, ID.FROST_AURA) && Math.abs(action.start - event.time) <= AURA_SIGNAL_WINDOW_MS
      )
    ) {
      return [];
    }

    // Dagger Frost Aura has no activation packet; its distinct ten-second self-aura is the recorded cast signal.
    return [
      instantAction(
        eventIndex,
        event.time,
        event.skillId,
        'Frost Aura',
        {
          name: 'Frost Aura',
          skillId: Number(skill.id)
        },
        'buff-transition',
        { independentTimeline: true }
      )
    ];
  });

  return [...actions, ...recovered];
}

function recoverBlindingFlashActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const identity = { skillId: ID.BLINDING_FLASH, name: 'Blinding Flash' };
  if (!findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile)) return [...actions];

  const explainedBlindTimes = actions.flatMap((action) => {
    if (isAction(action, ID.BLINDING_FLASH)) return [action.start];
    if (actionName(action) === 'Dodge') return [action.end];
    const skill = skillForAction(context, action);
    if (!skill) return [];
    const runtimeDuration = quicknessRuntimeDurationMs(skill);
    return (skill.effects || []).flatMap((effect) => {
      if (effect.type !== 'blind') return [];
      const scale = (value: number): number =>
        effect.timingScale === 'cast' ? projectCastRelativeEffectTimingMs(skill, runtimeDuration, value) : value;
      const first =
        effect.atMs == null
          ? action.start + runtimeDuration
          : action.start + (effect.timingAnchor === 'castEnd' ? runtimeDuration : 0) + scale(Number(effect.atMs));
      return Array.from(
        { length: Math.max(1, Math.trunc(Number(effect.applications || 1))) },
        (_, index) => first + index * scale(Math.max(0, Number(effect.intervalMs || 0)))
      );
    });
  });
  const attunements = actions
    .filter((action) => ELEMENTALIST_ATTUNEMENTS.some((element) => actionName(action) === `${element} Attunement`))
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const seenTimes = new Set<number>();
  const recovered = context.log.events.flatMap<EvtcRecordedRotationAction>((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target === 0n ||
      event.target === context.playerAddress ||
      event.skillId !== BLINDED_BUFF_ID ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.value <= 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY) ||
      seenTimes.has(event.time) ||
      explainedBlindTimes.some((time) => Math.abs(time - event.time) <= 80)
    ) {
      return [];
    }

    const currentAttunement = [...attunements].reverse().find((action) => action.start <= event.time);
    if (
      (currentAttunement ? actionName(currentAttunement).split(' ')[0] : configuredStartingAttunement(context)) !==
      'Air'
    ) {
      return [];
    }

    // ArcDPS omits the instant skill ID and records only its outgoing Blind packet.
    seenTimes.add(event.time);
    return [instantAction(eventIndex, event.time, event.skillId, 'Blinded', identity)];
  });

  return [...actions, ...recovered];
}

function orderSimultaneousAttunementTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return actions.map((action) => {
    if (action.evidence !== 'buff-transition') return action;
    const enteredElement = String(action.canonicalName || action.rawName).split(' ')[0];
    const precedingWeapon = actions.some((candidate) => {
      if (candidate === action || candidate.start !== action.start) return false;
      const skill = skillForAction(context, candidate);
      const attunements = String(skill?.attunement || '').split('+');
      return skill?.type === 'Weapon' && attunements.some(Boolean) && !attunements.includes(enteredElement);
    });
    if (!precedingWeapon) return action;
    // Same-millisecond animation and buff packets are unordered; a weapon from the
    // outgoing element must replay before the transition that would disable it.
    return { ...action, start: action.start + 1, end: action.end + 1 };
  });
}

export function reconstructElementalistProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  // Initial attunement snapshots describe state at log creation, not player inputs;
  // the active build owns starting state and may be adjusted by the user after import.
  let actions = context.recordedActions.filter(
    (action) =>
      !(
        action.initialState === true &&
        ELEMENTALIST_ATTUNEMENTS.some((element) => actionName(action) === `${element} Attunement`)
      )
  );
  actions = recoverMissingFireShieldActions(context, actions);
  actions = recoverMissingFrostAuraActions(context, actions);
  actions = recoverBlindingFlashActions(context, actions);
  actions = specializationAnalyzers.get(context.profile.specializationId)?.(context, actions) || actions;
  actions = inferArcLightningChannelDurations(context, actions);
  actions = filterUncommittedFlamestrikes(context, actions);
  actions = [...actions, ...collapsedHurlActions(context, actions), ...ownedElementalCommandActions(context)];
  return orderSimultaneousAttunementTransitions(context, actions).sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
