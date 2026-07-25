import { createEvent } from "./events.js";
import { createCooldownController } from "./cooldown-controller.js";
import { normalizeRotation } from "./rotation-commands.js";
import { createSchedulerState } from "./scheduler-state.js";
import { buildScheduledEventStream } from "./scheduled-event-stream.js";
import { sortQueuedEvents } from "./event-queue.js";

function baseDurationSeconds(skill) {
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
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
    };
    if (effect.type === "strike") {
      context.emit({
        ...base,
        type: "damage",
        name: skill.name,
        coefficient: Number(effect.coefficient || 0),
        hits: Math.max(1, Number(effect.hits || 1)),
        canCrit: effect.canCrit !== false,
      });
    } else if (effect.type === "condition") {
      context.emit({
        ...base,
        type: "condition",
        name: `${skill.name} — ${effect.condition}`,
        condition: effect.condition,
        stacks: Number(effect.stacks),
        duration: Number(effect.duration),
      });
    } else if (effect.type === "control" || effect.type === "blind") {
      context.emit({ ...base, type: effect.type });
    } else if (effect.type === "boon" || effect.type === "buff") {
      context.emit({
        ...base,
        type: "buff",
        kind: String(effect.boon || effect.kind || effect.name || "").toLowerCase(),
        stacks: Math.max(1, Number(effect.stacks || 1)),
        duration: Math.max(0, Number(effect.duration || 0)),
      });
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
  schedulerPolicy = {},
} = {}) {
  if (!profession?.id) throw new TypeError("Scheduler requires a profession.");
  const initialWeaponSet = schedulerPolicy.initialWeaponSet?.({
    profession,
    config,
  }) ?? 1;
  const state = createSchedulerState({
    profession,
    config,
    startingTime,
    activeWeaponSet: initialWeaponSet,
  });
  const events = [];
  const warnings = [];
  let order = 0;
  let previousCastStart = state.time;
  let hasPreviousCast = false;
  let combatStartTime = null;

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
    buffStacks(kind, at = state.time) {
      const normalized = String(kind || "").toLowerCase();
      const permanent = config.boons?.[normalized];
      const base = permanent === true ? 1 : Number(permanent || 0);
      return events
        .filter(event =>
          event.type === "buff"
          && String(event.kind || "").toLowerCase() === normalized
          && event.at <= at + epsilon
          && event.at + Number(event.duration || 0) > at + epsilon)
        .reduce((sum, event) => sum + Number(event.stacks || 1), base);
    },
    hasBuff(kind, at = state.time) {
      return context.buffStacks(kind, at) > 0;
    },
  };

  function castDurationFor(castContext, skill) {
    const baseDuration = baseDurationSeconds(skill);
    const sharedDuration = schedulerPolicy.castDuration?.(
      castContext,
      skill,
      baseDuration,
    ) ?? baseDuration;
    return Math.max(
      0,
      Number(profession.modifyCastDuration(castContext, sharedDuration) || 0),
    );
  }

  function rechargeDurationFor(skill, at = state.time, details = {}) {
    const rechargeContext = {
      ...context,
      ...details,
      skill,
      at,
    };
    const baseDuration = Math.max(
      0,
      Number(skill.cooldown ?? skill.recharge ?? 0),
    );
    const sharedDuration = schedulerPolicy.rechargeDuration?.(
      rechargeContext,
      skill,
      baseDuration,
    ) ?? baseDuration;
    return Math.max(
      0,
      Number(
        profession.modifyRechargeDuration(
          rechargeContext,
          sharedDuration,
        ) || 0,
      ),
    );
  }

  function maximumAmmoFor(skill) {
    const baseMaximum = Math.max(0, Number(skill.ammo || 0));
    const sharedMaximum = schedulerPolicy.maximumAmmo?.(
      { ...context, skill },
      skill,
      baseMaximum,
    ) ?? baseMaximum;
    return Math.max(
      0,
      Number(
        profession.modifyMaximumAmmo(
          { ...context, skill },
          sharedMaximum,
        ) || 0,
      ),
    );
  }

  const cooldownController = createCooldownController({
    state,
    epsilon,
    rechargeDuration: rechargeDurationFor,
    maximumAmmo: maximumAmmoFor,
  });
  context.cooldownController = cooldownController;
  profession.initialize(context);

  const skillFor = skillId =>
    catalog?.skillsById?.get(skillId)
    || catalog?.skills?.find(skill => skill.id === skillId);

  function advanceTo(time) {
    const target = Math.max(state.time, Number(time));
    for (const skillId of state.ammo.keys()) {
      const skill = skillFor(skillId);
      if (skill) cooldownController.refreshAmmo(skill, target);
    }
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
    const ammo = cooldownController.refreshAmmo(skill, start);
    const readyAt = state.cooldowns.get(skill.id) || 0;
    if (
      (ammo && ammo.charges <= 0)
      || (!ammo && readyAt > start + epsilon)
    ) {
      warnings.push(`${skill.name} is on cooldown until ${readyAt.toFixed(3)}.`);
      return;
    }
    const castContext = {
      ...context,
      command,
      commandIndex,
      skill,
      start,
      ammo,
    };
    if (!profession.validateCast(castContext, skill)) {
      warnings.push(`${skill.name} is unavailable.`);
      return;
    }

    const fullEnd = start + castDurationFor(castContext, skill);
    const effectiveEnd = command.interruptAfterMs == null
      ? fullEnd
      : Math.min(fullEnd, start + Number(command.interruptAfterMs) / 1000);
    const rechargeDuration = rechargeDurationFor(skill, effectiveEnd, {
      ...castContext,
      fullEnd,
      effectiveEnd,
    });
    const rechargeReadyAt = ammo
      ? (
          ammo.charges <= 1
            ? ammo.nextRechargeAt ?? effectiveEnd + rechargeDuration
            : null
        )
      : (
          rechargeDuration > 0
            ? effectiveEnd + rechargeDuration
            : null
        );
    const action = context.emit({
      type: "action",
      at: start,
      source: profession.id,
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      endsAt: effectiveEnd,
      fullEndsAt: fullEnd,
      rechargeReadyAt,
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

    if (ammo) {
      cooldownController.spendAmmo(skill, effectiveEnd);
    } else if (rechargeDuration) {
      state.cooldowns.set(skill.id, effectiveEnd + rechargeDuration);
    }
    state.skillUses.set(skill.id, (state.skillUses.get(skill.id) || 0) + 1);
    profession.afterCast({
      ...castContext,
      action,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      rechargeReadyAt,
    }, skill);
    previousCastStart = start;
    hasPreviousCast = true;
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
        if (combatStartTime != null) {
          warnings.push("Combat Start is already set.");
          continue;
        }
        const concurrent = (
          command.concurrentOffsetMs != null
          && hasPreviousCast
        );
        combatStartTime = concurrent
          ? previousCastStart + Number(command.concurrentOffsetMs) / 1000
          : state.time;
        context.emit({
          type: "combat_start",
          at: combatStartTime,
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
          hasExplicitCombatStart: combatStartTime != null,
          combatStartTime,
        },
      }),
    };
  }

  return { state, events, warnings, context, cast, advanceTo, run };
}
