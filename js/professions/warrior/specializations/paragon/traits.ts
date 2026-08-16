import type {
  ScheduledTask,
  SkillId,
} from "../../../../platform/engine/types.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  applyWarriorSkillResource,
  gainWarriorAdrenaline,
} from "../../core/resources.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill,
} from "../../types.js";
import { paragonState } from "./state.js";

const CHANT_IDS = [
  ID.CHANT_OF_ACTION,
  ID.CHANT_OF_RECUPERATION,
  ID.CHANT_OF_FREEDOM,
] as const;

// Broadcasts paragon state as a typed event so the resolver can mirror it.
// The resolver does not share mutable scheduler state, so motivation and
// refrain must travel through the event stream.
function emitParagonState(
  context: WarriorSchedulerContext,
  at: number,
  reason: string,
): void {
  const state = paragonState.from(context);
  context.emit({
    type: "warrior.paragon-state",
    at,
    source: "Paragon",
    sourceId: `warrior.paragon-state.${reason}`,
    actorType: "player",
    state: {
      motivation: state.motivation,
      maximumMotivation: state.maximumMotivation,
      activeRefrain: state.activeRefrain,
      nextRefrainAt: state.nextRefrainAt,
    },
  });
}

function emitBoon(
  context: WarriorSchedulerContext,
  at: number,
  sourceId: SkillId,
  skillName: string,
  boon: string,
  duration: number,
  stacks = 1,
  affectsSelf = true,
): void {
  context.emit({
    type: "buff",
    at,
    source: "Paragon",
    sourceId,
    actorType: "player",
    skillId: sourceId,
    skillName,
    name: `${skillName} — ${boon}`,
    kind: boon,
    boon,
    duration,
    stacks,
    recipients: affectsSelf ? "party" : "allies",
    affectsSelf,
  });
}

function gainMotivation(
  context: WarriorSchedulerContext,
  amount: number,
): void {
  const state = paragonState.from(context);
  state.motivation = Math.min(
    state.maximumMotivation,
    state.motivation + Math.max(0, amount),
  );
}

function motivationLevel(motivation: number): 1 | 2 | 3 {
  return motivation >= 7 ? 3 : motivation >= 4 ? 2 : 1;
}

export function activateChant(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  applyWarriorSkillResource(context, skill);
  const at = context.effectiveEnd;
  const state = paragonState.from(context);
  state.activeRefrain = skill.name;
  state.nextRefrainAt = at + 3;
  gainMotivation(
    context,
    4 + (hasTrait(context, TRAIT.ENDURING_REFRAIN) ? 1 : 0),
  );

  if (skill.id === ID.CHANT_OF_ACTION) {
    emitBoon(context, at, skill.id, skill.name, "might", 8, 5);
    emitBoon(context, at, skill.id, skill.name, "fury", 5);
  } else if (skill.id === ID.CHANT_OF_RECUPERATION) {
    emitBoon(context, at, skill.id, skill.name, "vigor", 5);
  } else if (skill.id === ID.CHANT_OF_FREEDOM) {
    emitBoon(context, at, skill.id, skill.name, "stability", 3);
  }

  if (hasTrait(context, TRAIT.FEVERISH_PULSE)) {
    for (const chantId of CHANT_IDS) {
      if (chantId === skill.id) continue;
      const readyAt = Number(context.state.cooldowns.get(chantId) || 0);
      if (readyAt > at) {
        context.state.cooldowns.set(chantId, Math.max(at, readyAt - 2));
      }
    }
    emitBoon(context, at, skill.id, skill.name, "alacrity", 6, 1, false);
  }
  emitParagonState(context, at + context.epsilon, "chant");
}

function executeCommandEcho(
  context: WarriorSchedulerContext,
  skillId: number,
  at: number,
): void {
  const skill = context.catalog.skillsById.get(skillId);
  const skillName = skill?.name || "Paragon Command";
  if (skillId === ID.FIND_THEIR_WEAKNESS) {
    emitBoon(context, at, skillId, skillName, "might", 10, 7);
    gainWarriorAdrenaline(context, 3);
  } else if (skillId === ID.NEVER_SURRENDER) {
    emitBoon(context, at, skillId, skillName, "resolution", 6);
    emitBoon(context, at, skillId, skillName, "regeneration", 6);
  } else if (skillId === ID.BRACE_YOURSELVES) {
    gainWarriorAdrenaline(context, 10);
  } else if (skillId === ID.ON_YOUR_KNEES) {
    context.emit({
      type: "damage",
      at,
      source: "Paragon",
      sourceId: skillId,
      actorType: "player",
      skillId,
      skillName,
      name: `${skillName} — Echo Damage`,
      coefficient: 1.5,
      hits: 1,
    });
    context.emit({
      type: "condition",
      at,
      source: "Paragon",
      sourceId: skillId,
      actorType: "player",
      skillId,
      skillName,
      name: `${skillName} — Echo Immobilized`,
      condition: "Immobilized",
      stacks: 1,
      duration: 2,
    });
  } else if (skillId === ID.WE_SHALL_RETURN) {
    gainWarriorAdrenaline(context, 10);
  }
}

function executePendingEcho(
  context: WarriorSchedulerContext,
  echoId: number,
  at: number,
): void {
  const state = paragonState.from(context);
  const index = state.pendingCommandEchoes.findIndex(
    (echo) => echo.id === echoId,
  );
  if (index < 0) return;
  const [echo] = state.pendingCommandEchoes.splice(index, 1);
  executeCommandEcho(context, Number(echo.skillId), at);
  if (echo.repeats > 1) {
    const next = { ...echo, dueAt: at + 3, repeats: echo.repeats - 1 };
    state.pendingCommandEchoes.push(next);
    context.tasks.schedule({
      type: "warrior.paragon-command-echo",
      at: next.dueAt,
      priority: -20,
      payload: { echoId: next.id },
    });
  }
}

export function activateCommand(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  if (skill.id === ID.FIND_THEIR_WEAKNESS) gainWarriorAdrenaline(context, 3);
  if (skill.id === ID.BRACE_YOURSELVES) gainWarriorAdrenaline(context, 10);

  const state = paragonState.from(context);
  const echo = {
    id: ++state.commandEchoSequence,
    skillId: skill.id,
    dueAt: context.effectiveEnd + 3,
    repeats: hasTrait(context, TRAIT.REVERBERATION) ? 2 : 1,
  };
  state.pendingCommandEchoes.push(echo);
  context.tasks.schedule({
    type: "warrior.paragon-command-echo",
    at: echo.dueAt,
    priority: -20,
    payload: { echoId: echo.id },
  });
}

function pulseRefrain(context: WarriorSchedulerContext, at: number): void {
  const state = paragonState.from(context);
  const motivation = state.motivation;
  const level = motivationLevel(motivation);
  const skill = [...context.catalog.skillsById.values()].find(
    (candidate) => candidate.name === state.activeRefrain,
  );
  if (!skill) return;

  let cost = 1;
  if (skill.id === ID.CHANT_OF_ACTION) {
    const extra = hasTrait(context, TRAIT.ENDURING_REFRAIN) ? level : 0;
    emitBoon(context, at, skill.id, skill.name, "might", 8, level + extra);
    if (level >= 2) emitBoon(context, at, skill.id, skill.name, "fury", 5);
  } else if (skill.id === ID.CHANT_OF_RECUPERATION) {
    cost = level === 3 ? 3 : 2;
    if (level === 3) {
      emitBoon(context, at, skill.id, skill.name, "regeneration", 3);
    }
  } else if (skill.id === ID.CHANT_OF_FREEDOM) {
    cost = level;
    emitBoon(context, at, skill.id, skill.name, "swiftness", 3);
    if (level >= 2) {
      emitBoon(context, at, skill.id, skill.name, "resolution", 3);
    }
    if (level === 3) {
      emitBoon(context, at, skill.id, skill.name, "protection", 3);
    }
  }

  state.motivation = Math.max(0, motivation - cost);
  if (state.motivation > 0) {
    state.nextRefrainAt = at + 3;
  } else {
    state.activeRefrain = "";
    state.nextRefrainAt = 0;
  }
  emitParagonState(context, at + context.epsilon, "refrain-pulse");
}

export function advanceParagon(
  context: WarriorSchedulerContext,
  target: number,
): void {
  const state = paragonState.from(context);
  while (
    state.activeRefrain &&
    state.motivation > 0 &&
    state.nextRefrainAt <= target + context.epsilon
  ) {
    pulseRefrain(context, state.nextRefrainAt);
  }
}

export function observeParagonEvent(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  const state = paragonState.from(context);
  if (
    event.type !== "combat_start" ||
    state.callToActionActivated ||
    !hasTrait(context, TRAIT.CALL_TO_ACTION)
  ) {
    return;
  }
  state.callToActionActivated = true;
  gainMotivation(context, 4);
  if (!state.activeRefrain) {
    state.activeRefrain = "Chant of Action";
    state.nextRefrainAt = event.at + 3;
  }
  emitParagonState(context, event.at + context.epsilon, "call-to-action");
}

export function updateParagonCast(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = paragonState.from(context);
  if (skill.burst && state.pendingCommandEchoes.length) {
    for (const echo of [...state.pendingCommandEchoes]) {
      executePendingEcho(context, echo.id, context.effectiveEnd);
    }
  }
  // skill.id === -3 is the weapon-swap pseudo-skill.
  if (
    skill.id === -3 &&
    hasTrait(context, TRAIT.INSPIRING_IMPLEMENTS) &&
    context.effectiveEnd + context.epsilon >= state.inspiringImplementsReadyAt
  ) {
    state.inspiringImplementsReadyAt = context.effectiveEnd + 4;
    gainWarriorAdrenaline(context, 5);
    gainMotivation(context, 2);
    emitParagonState(
      context,
      context.effectiveEnd + context.epsilon,
      "implements",
    );
  }
}

// Rally the Valiant motivation is added at cast START so it is visible during
// updateParagonCast (afterCast) when pending command echoes are flushed.
export function beginParagonCast(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = paragonState.from(context);
  if (
    !skill.burst ||
    skill.handlerId === "warrior.chant" ||
    !hasTrait(context, TRAIT.RALLY_THE_VALIANT) ||
    !state.activeRefrain
  ) {
    return;
  }
  gainMotivation(context, 4);
  emitParagonState(context, context.start + context.epsilon, "rally");
}

export function handleParagonCommandEchoTask(
  context: WarriorSchedulerContext,
  task: ScheduledTask,
): void {
  const payload = task.payload as { readonly echoId?: number } | null;
  executePendingEcho(context, Number(payload?.echoId), task.at);
}
