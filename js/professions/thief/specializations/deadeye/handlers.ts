import { deadeyeState } from "./state.js";
import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import { completeStealWithStoredSkill } from "../../core/steal.js";
import { emitStealTraitEffects } from "../../core/traits.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefInitiative,
} from "../../core/shared.js";
import {
  beginStealthAttack,
  completeStealthAttack,
} from "../../core/stealth.js";
import { grantThiefStealth } from "../../core/weapon-state.js";
import { consumeStoredStolenSkill } from "../../core/steal.js";
import { hasThiefTrait } from "../../core/state.js";
import { selectedDeadeyeStolenSkill } from "./mechanics.js";
import { emitDeadeyeBoon, initialDeadeyeMalice } from "./traits.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type {
  ThiefCastContext,
  ThiefSimulationEvent,
  ThiefSkill,
} from "../../types.js";

interface DeadeyeHandlerState {
  readonly malice?: number;
  readonly grantsStealth?: boolean;
}

function completeDeadeyesMark(context: ThiefCastContext): void {
  const state = deadeyeState.from(context);
  const at = context.effectiveEnd;
  state.markedTargetId = "primary-target";
  state.markExpiresAt = at + 30;
  state.markGeneration += 1;
  state.malice = initialDeadeyeMalice(context);
  state.maleficentSevenTriggered = false;
  completeStealWithStoredSkill(context, selectedDeadeyeStolenSkill(context));
  if (hasThiefTrait(context.config, TRAIT.BE_QUICK_OR_BE_KILLED)) {
    emitDeadeyeBoon(context, at, "Quickness", 4, 1, "Be Quick or Be Killed");
  }
  context.tasks.cancelOwner("thief.deadeye-mark");
  context.tasks.schedule({
    type: "thief.deadeye-mark-expire",
    at: state.markExpiresAt,
    ownerId: "thief.deadeye-mark",
    payload: { generation: state.markGeneration },
  });
  emitThiefState(context, at, "deadeyes-mark");
}

function prepareDeadeyeStealthAttack(
  context: ThiefCastContext,
  skill: ThiefSkill,
): DeadeyeHandlerState {
  const state = deadeyeState.from(context);
  if (
    state.markedTargetId &&
    state.markExpiresAt > context.start &&
    hasThiefTrait(context.config, TRAIT.MALICIOUS_INTENT)
  ) {
    state.malice = Math.min(state.maximumMalice, state.malice + 2);
    emitThiefState(context, context.start, "malicious-intent");
  }
  const handlerState = {
    malice: Math.max(0, Number(state.malice || 0)),
  };
  beginStealthAttack(context, skill);
  return handlerState;
}

function observeDeadeyeStealthEffect(
  context: ThiefCastContext,
  skill: ThiefSkill,
  event: ThiefSimulationEvent,
  handlerState: unknown,
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  if (
    skill.id === ID.MALICIOUS_SNEAK_ATTACK &&
    event.type === "condition" &&
    event.condition === "Torment"
  ) {
    context.replaceEvent(event, {
      duration: 1 + Number(prepared.malice || 0) * 2,
    });
  }
}

function prepareDeadeyeStolenSkill(
  context: ThiefCastContext,
): DeadeyeHandlerState {
  return { grantsStealth: deadeyeState.from(context).malice >= 3 };
}

function observeDeadeyeStolenEffect(
  context: ThiefCastContext,
  _skill: ThiefSkill,
  event: ThiefSimulationEvent,
  handlerState: unknown,
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  if (
    event.type === "buff" &&
    event.kind === "stealth" &&
    !prepared.grantsStealth
  ) {
    context.replaceEvent(event, { duration: 0, stacks: 0 });
  }
  if (event.type === "buff" && event.boon) {
    context.replaceEvent(event, {
      recipients: "party",
      maximumRecipients: 5,
    });
  }
}

function completeDeadeyeStolenSkill(
  context: ThiefCastContext,
  skill: ThiefSkill,
  handlerState: unknown,
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  if (prepared.grantsStealth) {
    grantThiefStealth(context, skill, context.effectiveEnd, 3);
  }
  consumeStoredStolenSkill(context);
  if (hasThiefTrait(context.config, TRAIT.FIRE_FOR_EFFECT)) {
    emitDeadeyeBoon(
      context,
      context.effectiveEnd,
      "Might",
      12,
      8,
      "Fire for Effect",
      true,
    );
    emitDeadeyeBoon(
      context,
      context.effectiveEnd,
      "Fury",
      12,
      1,
      "Fire for Effect",
      true,
    );
  }
}

function completeMercy(context: ThiefCastContext): void {
  const state = deadeyeState.from(context);
  const malice = Math.max(0, Number(state.malice || 0));
  state.malice = 0;
  state.maleficentSevenTriggered = false;
  context.state.cooldowns.delete(ID.DEADEYES_MARK);
  gainThiefInitiative(context, 3 + malice, context.effectiveEnd, "mercy");
  emitThiefState(context, context.effectiveEnd, "mercy");
}

function completeShadowFlare(context: ThiefCastContext): void {
  const core = professionCoreState(context);
  core.availableFlips[ID.SHADOW_SWAP] = context.effectiveEnd + 4;
  emitThiefState(context, context.effectiveEnd, "shadow-flare");
}

function completeShadowSwap(context: ThiefCastContext): void {
  delete professionCoreState(context).availableFlips[ID.SHADOW_SWAP];
  emitThiefState(context, context.effectiveEnd, "shadow-swap");
}

function prepareShadowMeld(context: ThiefCastContext): void {
  const core = professionCoreState(context);
  core.revealedUntil = Math.min(core.revealedUntil, context.start);
  emitThiefState(context, context.start, "shadow-meld");
}

function prepareDeadeyeSpearStealthAttack(
  context: ThiefCastContext,
  skill: ThiefSkill,
): DeadeyeHandlerState {
  const handlerState = {
    malice: Math.max(0, Number(deadeyeState.from(context).malice || 0)),
  };
  beginStealthAttack(context, skill);
  return handlerState;
}

function observeDeadeyeSpearStealthEffect(
  context: ThiefCastContext,
  _skill: ThiefSkill,
  event: ThiefSimulationEvent,
  handlerState: unknown,
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  if (
    event.type === "damage" &&
    event.name === "Malicious Ashen Assault — Final Strike"
  ) {
    context.replaceEvent(event, {
      coefficient:
        Number(event.coefficient || 0) *
        (1 + Number(prepared.malice || 0) * 0.02),
    });
  }
}

function completeDeadeyeSpearStealthAttack(
  context: ThiefCastContext,
  skill: ThiefSkill,
  handlerState: unknown,
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  const at = context.effectiveEnd;
  gainThiefInitiative(context, 4, at, "ashen-assault-refund");
  if (Number(prepared.malice || 0) > 0) {
    emitThiefCondition(context, {
      at,
      condition: "Torment",
      duration: 0.5 + Number(prepared.malice) * 0.5,
      stacks: 1,
      sourceId: skill.id,
      name: "Malicious Ashen Assault — Torment",
    });
  }
  completeStealthAttack(context, skill);
}

export const deadeyeSkillHandlers = Object.freeze({
  "thief.deadeyes-mark": augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeDeadeyesMark,
  }),
  "thief.deadeye-spear-stealth-attack": augmentSkillHandler(
    prepareDeadeyeSpearStealthAttack,
    {
      afterEffect: observeDeadeyeSpearStealthEffect,
      afterEffects: completeDeadeyeSpearStealthAttack,
    },
  ),
  "thief.deadeye-stealth-attack": augmentSkillHandler(
    prepareDeadeyeStealthAttack,
    {
      afterEffect: observeDeadeyeStealthEffect,
      afterEffects: completeStealthAttack,
    },
  ),
  "thief.deadeye-stolen-skill": augmentSkillHandler(prepareDeadeyeStolenSkill, {
    afterEffect: observeDeadeyeStolenEffect,
    afterEffects: completeDeadeyeStolenSkill,
  }),
  "thief.deadeye-mercy": augmentSkillHandler(null, {
    afterEffects: completeMercy,
  }),
  "thief.deadeye-shadow-flare": augmentSkillHandler(null, {
    afterEffects: completeShadowFlare,
  }),
  "thief.deadeye-shadow-swap": augmentSkillHandler(null, {
    afterEffects: completeShadowSwap,
  }),
  "thief.deadeye-shadow-meld": augmentSkillHandler(prepareShadowMeld),
});
