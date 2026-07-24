import { createEvent } from "./events.js";
import { normalizeRotation } from "./rotation-commands.js";
import { createSchedulerState } from "./scheduler-state.js";
import { buildScheduledEventStream } from "./scheduled-event-stream.js";
import { sortQueuedEvents } from "./event-queue.js";

function durationSeconds(skill) {
  if (skill.castTimeMs != null) return Math.max(0, Number(skill.castTimeMs)) / 1000;
  return Math.max(0, Number(skill.activation ?? skill.castTime ?? 0));
}

function effectAt(start, fullEnd, effect) {
  if (effect.atMs != null) return start + Number(effect.atMs) / 1000;
  if (effect.at != null) return start + Number(effect.at);
  return fullEnd;
}

function scheduleDeclarativeEffects(context, skill, start, fullEnd, effectiveEnd) {
  for (let index = 0; index < (skill.effects || []).length; index += 1) {
    const effect = skill.effects[index];
    const at = effectAt(start, fullEnd, effect);
    if (at > effectiveEnd + context.epsilon) continue;
    const base = {
      at,
      source: context.profession.id,
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
    };
    if (effect.type === "strike") {
      context.emit({
        ...base,
        type: "damage",
        coefficient: Number(effect.coefficient || 0),
        hits: Math.max(1, Number(effect.hits || 1)),
        canCrit: effect.canCrit !== false,
      });
    } else if (effect.type === "condition") {
      context.emit({
        ...base,
        type: "condition",
        condition: effect.condition,
        stacks: Number(effect.stacks),
        duration: Number(effect.duration),
      });
    } else if (effect.type === "control" || effect.type === "blind") {
      context.emit({ ...base, type: effect.type });
    } else if (effect.type === "custom") {
      context.emit({
        ...base,
        ...effect.event,
        type: effect.eventType,
      });
    }
  }
}

export function createScheduler({
  profession,
  config = {},
  catalog = profession?.catalog,
  startingTime = 0,
  epsilon = 0.0001,
} = {}) {
  if (!profession?.id) throw new TypeError("Scheduler requires a profession.");
  const state = createSchedulerState({ profession, config, startingTime });
  const events = [];
  const warnings = [];
  let order = 0;
  let previousCastStart = state.time;

  const context = {
    profession,
    config,
    catalog,
    state,
    events,
    warnings,
    epsilon,
    emit(event) {
      const normalized = createEvent({ ...event, __order: order++ });
      events.push(normalized);
      state.pendingEvents.push(normalized);
      return normalized;
    },
  };
  profession.initialize(context);

  const skillFor = skillId =>
    catalog?.skillsById?.get(skillId)
    || catalog?.skills?.find(skill => skill.id === skillId);

  function advanceTo(time) {
    const target = Math.max(state.time, Number(time));
    profession.advance(context, target);
    state.time = target;
    state.pendingEvents = state.pendingEvents
      .filter(event => event.at > target + epsilon);
  }

  function cast(command, commandIndex) {
    const skill = skillFor(command.skillId);
    if (!skill) {
      warnings.push(`Unknown skill id ${command.skillId}.`);
      return;
    }
    const concurrent = command.concurrentOffsetMs != null;
    const start = concurrent
      ? previousCastStart + Number(command.concurrentOffsetMs) / 1000
      : state.time;
    const readyAt = state.cooldowns.get(skill.id) || 0;
    if (readyAt > start + epsilon) {
      warnings.push(`${skill.name} is on cooldown until ${readyAt.toFixed(3)}.`);
      return;
    }
    const castContext = {
      ...context,
      command,
      commandIndex,
      skill,
      start,
    };
    if (!profession.validateCast(castContext, skill)) {
      warnings.push(`${skill.name} is unavailable.`);
      return;
    }

    const fullEnd = start + durationSeconds(skill);
    const effectiveEnd = command.interruptAfterMs == null
      ? fullEnd
      : Math.min(fullEnd, start + Number(command.interruptAfterMs) / 1000);
    const action = context.emit({
      type: "action",
      at: start,
      source: profession.id,
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
      endsAt: effectiveEnd,
      fullEndsAt: fullEnd,
      interrupted: effectiveEnd < fullEnd - epsilon,
    });
    const handled = profession.scheduleSkill({
      ...castContext,
      action,
      fullEnd,
      effectiveEnd,
    }, skill);
    if (handled !== true) {
      scheduleDeclarativeEffects(context, skill, start, fullEnd, effectiveEnd);
    }

    const cooldown = Math.max(
      0,
      Number(skill.cooldown ?? skill.recharge ?? 0),
    );
    if (cooldown) state.cooldowns.set(skill.id, effectiveEnd + cooldown);
    state.skillUses.set(skill.id, (state.skillUses.get(skill.id) || 0) + 1);
    profession.afterCast({
      ...castContext,
      action,
      fullEnd,
      effectiveEnd,
    }, skill);
    previousCastStart = start;
    state.time = concurrent
      ? Math.max(state.time, effectiveEnd)
      : effectiveEnd;
    advanceTo(state.time);
  }

  function run(rotation) {
    const commands = normalizeRotation(rotation, catalog, { strict: true });
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];
      if (command.type === "wait") {
        advanceTo(state.time + command.durationMs / 1000);
      } else if (command.type === "combat-start") {
        context.emit({
          type: "action",
          at: state.time,
          source: "platform",
          sourceId: "combat-start",
          action: "combat-start",
        });
      } else {
        cast(command, index);
      }
    }
    sortQueuedEvents(events);
    return {
      state,
      events,
      warnings,
      snapshot: profession.snapshot(context) ?? structuredClone(state.profession),
      stream: buildScheduledEventStream({
        events,
        rotationEndTime: Math.max(state.time, 0.001),
        resolverHandoff: {
          profession: profession.id,
          professionState: profession.snapshot(context)
            ?? structuredClone(state.profession),
        },
      }),
    };
  }

  return { state, events, warnings, context, cast, advanceTo, run };
}
