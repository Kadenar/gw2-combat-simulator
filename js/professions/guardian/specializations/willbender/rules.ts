import { isGw2PlayerActorEvent } from "../../../../platform/gw2/event-ownership.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  GUARDIAN_SKILL_IDS as ID,
  GUARDIAN_TRAIT_IDS,
} from "../../data/ids.js";
import { buildGuardianStrike } from "../../core/events.js";
import {
  emitGuardianProc,
  guardianTraitIcon,
  hasGuardianTrait,
} from "../../core/traits.js";
import type {
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  GuardianCastContext,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianVirtue,
} from "../../types.js";
import {
  activeLethalTempo,
  gainLethalTempo,
  WILLBENDER_FLAME_DURATION,
  WILLBENDER_FLAME_INTERVAL,
  WILLBENDER_TRIGGER_HITS,
} from "./mechanics.js";
import { willbenderState } from "./state.js";

function lethalTempoStacks(context: Gw2ModifierContext): number {
  return activeLethalTempo(willbenderState.from(context), context.time);
}

export const willbenderModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "guardian.willbender.lethal-tempo-strike",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) =>
        1 +
        lethalTempoStacks(context) *
          (hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM)
            ? 0.05
            : 0.02),
      order: 100,
    },
    {
      id: "guardian.willbender.lethal-tempo-condition",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: (context) =>
        1 +
        lethalTempoStacks(context) *
          (hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM)
            ? 0.03
            : 0.02),
      order: 100,
    },
    {
      id: "guardian.willbender.power-for-power",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 3,
      order: 100,
      when: (context) =>
        Boolean(context.event?.willbenderFlames) &&
        hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_FOR_POWER),
    },
  ]);

export const willbenderAttributeRules = Object.freeze({
  modifierRules: willbenderModifierRules,
});

function activeWeaponNames(context: GuardianSchedulerContext): Set<string> {
  const configured =
    context.state.activeWeaponSet === 2
      ? [context.config.weaponSet2Primary, context.config.weaponSet2Secondary]
      : [context.config.primaryWeapon, context.config.secondaryWeapon];
  return new Set(
    configured.map((weapon) => String(weapon || "")).filter(Boolean),
  );
}

function isActiveWeaponSkill(
  skill: GuardianSkill | undefined,
  weaponNames: ReadonlySet<string>,
): skill is GuardianSkill {
  return Boolean(
    skill?.type === "Weapon" &&
    (!weaponNames.size || weaponNames.has(String(skill.weapon || ""))),
  );
}

function reduceWeaponCooldown(
  context: GuardianSchedulerContext,
  skill: GuardianSkill,
  at: number,
  reduction = 0.25,
): number {
  if (context.state.ammo.has(skill.id)) {
    return context.cooldownController.reduceAmmoRecharge(skill, reduction, at)
      .reducedBy;
  }
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (readyAt <= at + context.epsilon) return 0;
  const reducedBy = Math.min(reduction, readyAt - at);
  context.state.cooldowns.set(skill.id, readyAt - reducedBy);
  return reducedBy;
}

function queueInFlightWeaponCooldownReduction(
  context: GuardianSchedulerContext,
  weaponNames: ReadonlySet<string>,
  at: number,
): number {
  const state = willbenderState.from(context);
  let reducedBy = 0;
  for (const event of context.events) {
    if (
      event.type !== "action" ||
      event.cancelled === true ||
      Number(event.at) > at + context.epsilon ||
      Number(event.endsAt) < at - context.epsilon ||
      Number(event.rechargeReadyAt || 0) <= at + context.epsilon
    ) {
      continue;
    }
    if (event.skillId == null) continue;
    const skill = context.catalog.skillsById.get(event.skillId) as
      GuardianSkill | undefined;
    if (!isActiveWeaponSkill(skill, weaponNames)) continue;
    const activationId = String(event.activationId || "");
    if (!activationId) continue;
    const pending = Number(
      state.pendingWeaponCooldownReduction[activationId] || 0,
    );
    const available = Math.max(0, Number(event.rechargeReadyAt) - at - pending);
    const reduction = Math.min(0.25, available);
    if (reduction <= context.epsilon) continue;
    state.pendingWeaponCooldownReduction[activationId] = pending + reduction;
    reducedBy += reduction;
  }
  return reducedBy;
}

function reduceActiveWeaponCooldowns(
  context: GuardianSchedulerContext,
  at: number,
): number {
  const weaponNames = activeWeaponNames(context);
  const activeIds = new Set<SkillId>([
    ...context.state.cooldowns.keys(),
    ...context.state.ammo.keys(),
  ]);
  let reducedBy = 0;
  for (const skillId of activeIds) {
    const skill = context.catalog.skillsById.get(skillId) as
      GuardianSkill | undefined;
    if (isActiveWeaponSkill(skill, weaponNames)) {
      reducedBy += reduceWeaponCooldown(context, skill, at);
    }
  }
  reducedBy += queueInFlightWeaponCooldownReduction(context, weaponNames, at);
  return reducedBy;
}

function applyPendingWeaponCooldownReduction(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  const activationId = String(context.reservationId || "");
  if (!activationId) return;
  const state = willbenderState.from(context);
  const pending = Number(
    state.pendingWeaponCooldownReduction[activationId] || 0,
  );
  delete state.pendingWeaponCooldownReduction[activationId];
  if (pending <= context.epsilon || skill.type !== "Weapon") return;
  reduceWeaponCooldown(context, skill, context.effectiveEnd, pending);
}

function emitLethalTempo(
  context: GuardianSchedulerContext,
  at: number,
  sourceSkill: string,
): void {
  const state = willbenderState.from(context);
  const tyrantsMomentum = hasGuardianTrait(
    context,
    GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM,
  );
  gainLethalTempo(state, at, tyrantsMomentum);
  context.emit({
    type: "buff",
    at,
    source: "guardian",
    sourceId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
    actorType: "player",
    skillId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
    skillName: "Lethal Tempo",
    name: "Lethal Tempo",
    kind: "lethal-tempo",
    stacks: state.lethalTempoStacks,
    duration: state.lethalTempoUntil - at,
    triggeredBy: sourceSkill,
  });
}

function handleWillbenderFlameActivation(
  context: GuardianSchedulerContext,
  task: SchedulerRecord,
): void {
  const payload = task.payload as SchedulerRecord | undefined;
  const virtue = payload?.virtue as GuardianVirtue | undefined;
  if (!payload || !virtue) return;
  const state = willbenderState.from(context);
  if (state.flameVirtue !== virtue) state.flameGeneration += 1;
  state.flameVirtue = virtue;
  const flameGeneration = state.flameGeneration;
  const flameId = Number(payload.flameId);
  for (let pulse = 1; pulse <= WILLBENDER_FLAME_DURATION; pulse += 1) {
    context.tasks.schedule({
      id: `guardian.willbender-flame:${flameGeneration}:${task.at}:${pulse}`,
      type: "guardian.willbender-flame-pulse",
      at: Number(task.at) + pulse * WILLBENDER_FLAME_INTERVAL,
      payload: { flameGeneration, flameId, pulse },
    });
  }
}

function handleWillbenderFlamePulse(
  context: GuardianSchedulerContext,
  task: SchedulerRecord,
): void {
  const payload = task.payload as SchedulerRecord | undefined;
  const state = willbenderState.from(context);
  if (!payload || Number(payload.flameGeneration) !== state.flameGeneration) {
    return;
  }
  const at = Number(task.at);
  const flameId = Number(payload.flameId);
  const pulse = Number(payload.pulse);
  context.emit(
    buildGuardianStrike({
      at,
      sourceId: flameId,
      skillId: flameId,
      skillName: "Willbender Flames",
      name: "Willbender Flames",
      coefficient: 0.22,
      skillWeapon: "Unequipped",
      hitIndex: pulse,
      totalHits: 5,
      willbenderFlames: true,
    }),
  );
  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.SEARING_PACT)) {
    context.emit({
      type: "condition",
      at,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.SEARING_PACT,
      actorType: "player",
      skillId: GUARDIAN_TRAIT_IDS.SEARING_PACT,
      skillName: "Searing Pact",
      name: "Searing Pact — Burning",
      condition: "Burning",
      stacks: 1,
      duration: 1,
      triggeredBy: "Willbender Flames",
    });
  }
}

function handleWillbenderVirtueHit(
  context: GuardianSchedulerContext,
  task: SchedulerRecord,
): void {
  const payload = task.payload as SchedulerRecord | undefined;
  if (!payload) return;
  const at = Number(task.at);
  const state = willbenderState.from(context);
  const sourceSkill = String(payload.sourceSkillName || "");

  const triggerVirtue = (
    virtue: GuardianVirtue,
    burningDuration?: number,
    justiceActive?: boolean,
  ): void => {
    state.triggeredVirtueEffects += 1;
    emitLethalTempo(context, at, sourceSkill);

    let cooldownReduction = 0;
    if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES)) {
      cooldownReduction = reduceActiveWeaponCooldowns(context, at);
      if (cooldownReduction > 0) {
        emitGuardianProc(context, {
          name: "Restorative Virtues",
          at,
          sourceSkill,
          detail: `${Number(cooldownReduction.toFixed(3))}s weapon recharge`,
          icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES),
        });
      }
    }
    context.emit({
      type: "guardian.willbender-virtue-triggered",
      at,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
      actorType: "player",
      virtue,
      sourceSkill,
      cooldownReduction,
      ...(burningDuration == null ? {} : { burningDuration }),
      ...(justiceActive == null ? {} : { justiceActive }),
    });
    if (virtue === "courage") {
      for (const kind of ["aegis", "stability"] as const) {
        context.emit({
          type: "buff",
          at,
          source: "guardian",
          sourceId: ID.CRASHING_COURAGE_ID_62648,
          actorType: "player",
          skillId: ID.CRASHING_COURAGE_ID_62648,
          skillName: "Crashing Courage",
          name: `Crashing Courage — Triggered ${kind === "aegis" ? "Aegis" : "Stability"}`,
          kind,
          stacks: 1,
          duration: 4,
          triggeredBy: sourceSkill,
        });
      }
    }
    if (
      virtue === "resolve" &&
      hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL)
    ) {
      context.emit({
        type: "buff",
        at,
        source: "guardian",
        sourceId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
        actorType: "player",
        skillId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
        skillName: "Phoenix Protocol",
        name: "Phoenix Protocol — Alacrity",
        kind: "alacrity",
        stacks: 1,
        duration: 1,
        triggeredBy: sourceSkill,
      });
    }
  };

  for (const virtue of ["justice", "resolve", "courage"] as const) {
    if (state[`${virtue}Until`] <= at + context.epsilon) continue;
    state.virtueHitCounts[virtue] += 1;
    const triggerHits =
      virtue === "justice" &&
      hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH)
        ? 3
        : WILLBENDER_TRIGGER_HITS;
    if (state.virtueHitCounts[virtue] < triggerHits) continue;
    state.virtueHitCounts[virtue] = 0;
    triggerVirtue(
      virtue,
      virtue === "justice" ? 2 : undefined,
      virtue === "justice" ? true : undefined,
    );
  }
}

function observeWillbenderEvent(
  context: GuardianSchedulerContext,
  event: SchedulerRecord,
): void {
  if (
    event.type !== "damage" ||
    !(Number(event.coefficient || 0) > 0) ||
    (!isGw2PlayerActorEvent(event) && event.sourceId !== "sigil.air")
  ) {
    return;
  }
  context.tasks.schedule({
    id: `guardian.willbender-virtue-hit:${String(event.__order ?? event.at)}`,
    type: "guardian.willbender-virtue-hit",
    at: Number(event.at),
    payload: {
      sourceSkillId: event.skillId,
      sourceSkillName: event.skillName,
    },
  });
}

function finishWillbenderCast(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  if (skill.id === ID.FLASH_COMBO) {
    context.state.profession.core.availableFlips[ID.REPOSE] =
      context.effectiveEnd + 6;
  }
}

export const willbenderSchedulerHooks = Object.freeze({
  afterCast: Object.freeze([
    {
      id: "guardian.willbender-flash-combo",
      order: 40,
      handler: finishWillbenderCast,
    },
  ]),
  onCastComplete: Object.freeze([
    {
      id: "guardian.willbender-restorative-virtues",
      order: 40,
      handler: applyPendingWeaponCooldownReduction,
    },
  ]),
  onEventScheduled: Object.freeze([
    {
      id: "guardian.willbender-virtue-hits",
      order: 40,
      handler: observeWillbenderEvent,
    },
  ]),
  taskHandlers: Object.freeze({
    "guardian.willbender-flame-activate": handleWillbenderFlameActivation,
    "guardian.willbender-flame-pulse": handleWillbenderFlamePulse,
    "guardian.willbender-virtue-hit": handleWillbenderVirtueHit,
  }),
});
