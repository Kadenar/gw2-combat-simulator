import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import type { ScheduledTask } from "../../../../platform/engine/types.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type {
  WarriorCastContext,
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill,
} from "../../types.js";
import {
  warriorBalanceProfile,
  warriorBalanceProfileEffect,
} from "../../core/profiles.js";
import { emitBerserkMarker } from "./mechanics.js";
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";
import { berserkerState } from "./state.js";

const FIRE_AURA_ICON =
  "https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fire_Aura.png";

function emitBoon(
  context: WarriorCastContext,
  skill: WarriorSkill,
  name: string,
  boon: string,
  duration: number,
  stacks = 1,
  recipients?: string,
): void {
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: "Trait",
    sourceId:
      name === "Burst of Aggression"
        ? TRAIT.BURST_OF_AGGRESSION
        : name === "Bloody Roar"
          ? TRAIT.BLOODY_ROAR
          : TRAIT.HEAT_THE_SOUL,
    actorType: "effect",
    skillId: skill.id,
    skillName: skill.name,
    name,
    kind: boon,
    boon,
    duration,
    stacks,
    ...(recipients ? { recipients } : {}),
  });
}

export function berserkEntryDuration(context: WarriorCastContext): number {
  const effect = warriorBalanceProfileEffect(
    warriorBalanceProfile(context, PROFILE.resources),
    "buff",
  );
  return Number(effect?.duration ?? 20);
}

export function applyBerserkEntryTraits(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const burstOfAggression = warriorBalanceProfile(
    context,
    PROFILE.burstOfAggression,
  );
  for (const effect of burstOfAggression?.effects || []) {
    if (effect.type !== "boon") continue;
    emitBoon(
      context,
      skill,
      "Burst of Aggression",
      String(effect.boon || effect.kind || ""),
      Number(effect.duration || 0),
      Number(effect.stacks || 1),
    );
  }
  if (hasTrait(context, TRAIT.BLOODY_ROAR)) {
    const resistance = warriorBalanceProfileEffect(
      warriorBalanceProfile(context, PROFILE.bloodyRoar),
      "boon",
    );
    emitBoon(
      context,
      skill,
      "Bloody Roar",
      String(resistance?.boon || resistance?.kind || "resistance"),
      Number(resistance?.duration ?? 3.5),
      Number(resistance?.stacks ?? 1),
    );
  }
}

function isComplete(context: WarriorCastContext): boolean {
  return context.effectiveEnd >= context.fullEnd - context.epsilon;
}

/**
 * Base berserk-duration extension (seconds) granted by each rage skill on hit,
 * before the Last Blaze bonus. Entering berserk (Berserk itself) grants none;
 * unlisted rage skills use the shared default.
 */
function rageBerserkExtension(
  context: WarriorCastContext,
  skill: WarriorSkill,
): number {
  const profile = warriorBalanceProfile(context, PROFILE.rageExtensions);
  switch (skill.id) {
    case ID.BERSERK:
    case ID.BERSERK_ID_30435:
      return 0;
    case ID.WILD_BLOW:
      return Number(profile?.maximumStacks ?? 5);
    case ID.OUTRAGE:
      // The simulator always has a nearby target, so Outrage uses its
      // increased three-second extension instead of the one-second base.
      return Number(profile?.threshold ?? 3);
    case ID.SUNDERING_LEAP:
    case ID.SHATTERING_BLOW:
      return Number(profile?.threshold ?? 3);
    default:
      return Number(profile?.minimumStacks ?? 2);
  }
}

function extendBerserk(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = berserkerState.from(context);
  if (!state.berserkActive || !isComplete(context)) return;
  const previousUntil = state.berserkUntil;
  if (skill.primalBurst && hasTrait(context, TRAIT.SMASH_BRAWLER)) {
    const profile = warriorBalanceProfile(context, PROFILE.smashBrawler);
    state.berserkUntil +=
      skill.id === ID.DECAPITATE
        ? Number(profile?.minimumStacks ?? 1)
        : Number(profile?.resourceGain ?? 2);
  }
  if (
    skill.categories?.includes("Rage") &&
    skill.id !== ID.BERSERK &&
    skill.id !== ID.BERSERK_ID_30435
  ) {
    state.berserkUntil +=
      rageBerserkExtension(context, skill) +
      (skill.id !== ID.OUTRAGE && hasTrait(context, TRAIT.LAST_BLAZE)
        ? Number(
            warriorBalanceProfile(context, PROFILE.lastBlaze)
              ?.durationMultiplier ?? 1,
          )
        : 0);
  }
  if (state.berserkUntil > previousUntil) emitBerserkMarker(context, skill);
}

function applyBerserkerTraits(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  if (!isComplete(context)) return;
  if (
    skill.categories?.includes("Rage") &&
    hasTrait(context, TRAIT.LAST_BLAZE)
  ) {
    const burning = warriorBalanceProfileEffect(
      warriorBalanceProfile(context, PROFILE.lastBlaze),
      "condition",
    );
    context.emit({
      type: "condition",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.LAST_BLAZE,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Last Blaze — Burning",
      condition: "Burning",
      stacks: Number(burning?.stacks ?? 1),
      duration: Number(burning?.duration ?? 4),
    });
  }
  if (skill.primalBurst && hasTrait(context, TRAIT.HEAT_THE_SOUL)) {
    const profile = warriorBalanceProfile(context, PROFILE.heatTheSoul);
    const quickness = warriorBalanceProfileEffect(profile, "boon", 0);
    const fury = warriorBalanceProfileEffect(profile, "boon", 1);
    const might = warriorBalanceProfileEffect(profile, "boon", 2);
    emitBoon(
      context,
      skill,
      "Heat the Soul — Quickness",
      "quickness",
      skill.id === ID.DECAPITATE
        ? Number(
            warriorBalanceProfile(context, PROFILE.smashBrawler)
              ?.resourceGain ?? 2,
          )
        : Number(quickness?.duration ?? 5),
      Number(quickness?.stacks ?? 1),
      "party",
    );
    emitBoon(
      context,
      skill,
      "Heat the Soul — Fury",
      "fury",
      Number(fury?.duration ?? 5),
      Number(fury?.stacks ?? 1),
      "party",
    );
    emitBoon(
      context,
      skill,
      "Heat the Soul — Might",
      "might",
      Number(might?.duration ?? 5),
      Number(might?.stacks ?? 3),
      "party",
    );
  }
}

function isBerserkerSkill(skill: WarriorSkill): boolean {
  return Boolean(
    skill.primalBurst ||
    skill.categories?.includes("Rage") ||
    skill.specialization === "Berserker",
  );
}

function emitFireAura(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
  source: "Combo" | "Trait",
): void {
  const fromTrait = source === "Trait";
  const effect = warriorBalanceProfileEffect(
    warriorBalanceProfile(context, PROFILE.kingOfFires),
    "buff",
  );
  const duration = Number(effect?.duration ?? 5);
  berserkerState.from(context).fireAuraUntil = event.at + duration;
  const common = {
    at: event.at,
    source,
    sourceId: fromTrait ? TRAIT.KING_OF_FIRES : "warrior.combo.fire-leap",
    actorType: "effect",
    skillId: event.skillId,
    skillName: event.skillName,
  } as const;
  context.emitDerived(event, {
    ...common,
    type: "buff",
    name: fromTrait ? "King of Fires — Fire Aura" : "Fire Aura — Leap Combo",
    kind: "fire-aura",
    stacks: Number(effect?.stacks ?? 1),
    duration,
  });
  context.emitDerived(event, {
    ...common,
    type: "proc",
    procType: fromTrait ? "trait" : "skill",
    name: "Fire Aura",
    sourceSkill: String(event.skillName || event.name || ""),
    detail: fromTrait ? "Granted by King of Fires" : "Granted by leap combo",
    icon: FIRE_AURA_ICON,
  });
}

function criticalCount(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): number {
  if (context.config.randomness?.mode === "stochastic") {
    return event.didCrit === true ? 1 : 0;
  }
  const criticalPolicy = context.schedulerPolicy as unknown as {
    critical?: (
      schedulerContext: WarriorSchedulerContext,
      simulationEvent: WarriorSimulationEvent,
    ) => { chance?: number };
  };
  const state = berserkerState.from(context);
  // Accumulate fractional crit probability so expected crits fire at the
  // statistically correct rate in deterministic mode.
  state.kingOfFiresCriticalProgress += Number(
    criticalPolicy.critical?.(context, event)?.chance || 0,
  );
  const count = Math.floor(state.kingOfFiresCriticalProgress + 1e-9);
  state.kingOfFiresCriticalProgress -= count;
  return count;
}

export function observeBerserkerEvent(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  if (event.type === "aura" && event.aura === "Fire Aura") {
    berserkerState.from(context).fireAuraUntil = Math.max(
      berserkerState.from(context).fireAuraUntil,
      event.at + Number(event.duration || 0),
    );
    return;
  }
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  if (!hasTrait(context, TRAIT.KING_OF_FIRES)) return;
  context.tasks.schedule({
    type: "warrior.king-of-fires-hit",
    at: Math.max(context.state.time, event.at),
    priority: -30,
    payload: { eventOrder: Number(event.__order) },
    required: true,
  });
}

export function reactToBerserkerAura(
  context: WarriorResolverContext,
  event: WarriorResolverEvent,
): void {
  if (event.aura !== "Fire Aura") return;
  berserkerState.from(context).fireAuraUntil = Math.max(
    berserkerState.from(context).fireAuraUntil,
    event.at + Number(event.duration || 0),
  );
}

export function handleKingOfFiresHitTask(
  context: WarriorSchedulerContext,
  task: ScheduledTask,
): void {
  const payload = task.payload as { readonly eventOrder?: number } | null;
  const event = context.events.find(
    (candidate) => candidate.__order === Number(payload?.eventOrder),
  ) as WarriorSimulationEvent | undefined;
  if (!event) return;

  const state = berserkerState.from(context);
  if (
    event.at + context.epsilon < state.kingOfFiresReadyAt ||
    criticalCount(context, event) === 0
  ) {
    return;
  }
  const profile = warriorBalanceProfile(context, PROFILE.kingOfFires);
  state.kingOfFiresReadyAt = event.at + Number(profile?.internalCooldown ?? 15);
  emitFireAura(context, event, "Trait");
  const skill =
    event.skillId == null
      ? null
      : context.catalog.skillsById.get(event.skillId);
  const action = context.events.find(
    (candidate) =>
      candidate.type === "action" &&
      candidate.activationId === event.activationId,
  );
  if (
    skill &&
    isBerserkerSkill(skill) &&
    Number(action?.endsAt) < event.at - context.epsilon
  ) {
    context.tasks.schedule({
      type: "warrior.king-of-fires-detonation",
      at: event.at,
      priority: -20,
      payload: {
        activationId: event.activationId,
        skillId: skill.id,
      },
      required: true,
    });
  }
}

export function handleKingOfFiresDetonationTask(
  context: WarriorSchedulerContext,
  task: ScheduledTask,
): void {
  const payload = task.payload as {
    readonly activationId?: string;
    readonly skillId?: number;
  } | null;
  const skill = context.catalog.skillsById.get(Number(payload?.skillId));
  if (!skill) return;
  const state = berserkerState.from(context);
  if (state.fireAuraUntil <= task.at + context.epsilon) return;
  const profile = warriorBalanceProfile(context, PROFILE.kingOfFires);
  const strike = warriorBalanceProfileEffect(profile, "strike");
  const burning = warriorBalanceProfileEffect(profile, "condition");

  state.fireAuraUntil = 0;
  const common = {
    activationId: payload?.activationId,
    at: task.at,
    source: "Trait",
    sourceId: TRAIT.KING_OF_FIRES,
    actorType: "effect",
    skillId: skill.id,
    skillName: skill.name,
  } as const;
  context.emit({
    ...common,
    type: "proc",
    procType: "trait",
    name: "King of Fires",
    sourceSkill: skill.name,
    detail: "Fire Aura detonated",
  });
  context.emit({
    ...common,
    type: "damage",
    name: "King of Fires — Fire Aura Detonation",
    coefficient: Number(strike?.coefficient ?? 0.7),
    canTriggerCriticalTraits: true,
  });
  context.emit({
    ...common,
    type: "condition",
    name: "King of Fires — Burning",
    condition: "Burning",
    stacks: Number(burning?.stacks ?? 3),
    duration: Number(burning?.duration ?? 3),
  });
}

export function finishBerserkerCast(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  extendBerserk(context, skill);
  applyBerserkerTraits(context, skill);
  if (
    isComplete(context) &&
    isBerserkerSkill(skill) &&
    hasTrait(context, TRAIT.KING_OF_FIRES)
  ) {
    context.tasks.schedule({
      type: "warrior.king-of-fires-detonation",
      at: context.effectiveEnd,
      priority: -20,
      payload: {
        activationId: context.reservationId,
        skillId: skill.id,
      },
      required: true,
    });
  }
}
