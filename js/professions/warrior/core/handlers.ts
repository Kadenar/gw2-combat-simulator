import { professionCoreState } from "../../../platform/engine/profession.js";
import type { ScheduledTask } from "../../../platform/engine/types.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../platform/engine/skill-handlers.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { applyWarriorSkillResource } from "./resources.js";
import { gainWarriorAdrenaline, gainWarriorEndurance } from "./resources.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill,
} from "../types.js";

const MOVEMENT_SKILL_IDS = new Set<number>([
  ID.SAVAGE_LEAP,
  ID.WHIRLWIND_ATTACK,
  ID.RUSH,
  ID.BRUTAL_SHOT,
  ID.VALIANT_LEAP,
  ID.LINE_BREAKER,
  ID.SPEAR_SWIPE,
  ID.AURA_SLICER,
  ID.GUNSTINGER,
  ID.DRAGONS_ROAR,
  ID.BREAK_STEP,
  ID.DRAGON_SLASH_BOOST,
  ID.BULLS_CHARGE,
  ID.KICK,
  ID.STOMP,
  ID.SUNDERING_LEAP,
  ID.DRAGONSPIKE_MINE,
  ID.HEAD_BUTT,
  ID.EVISCERATE,
  ID.BREACHING_STRIKE,
  ID.EARTHSHAKER,
  ID.RUPTURING_SMASH,
]);

function grantBerserkersPower(
  context: WarriorCastContext,
  requestedStacks: number,
  at: number,
  skill: WarriorSkill,
): void {
  if (!hasTrait(context, TRAIT.BERSERKERS_POWER)) return;
  const state = professionCoreState(context);
  state.burstPowerExpiries = state.burstPowerExpiries.filter(
    (expiresAt) => expiresAt > at,
  );
  const granted = Math.min(
    Math.max(0, 4 - state.burstPowerExpiries.length),
    Math.max(0, requestedStacks),
  );
  if (!granted) return;
  state.burstPowerExpiries.push(...Array(granted).fill(at + 10));
  context.emit({
    type: "buff",
    at,
    source: "Trait",
    sourceId: TRAIT.BERSERKERS_POWER,
    actorType: "effect",
    skillId: skill.id,
    skillName: skill.name,
    name: "Berserker's Power",
    kind: "berserkers-power",
    stacks: granted,
    duration: 10,
  });
}

function afterResourceSkill(
  context: WarriorCastContext,
  skill: WarriorSkill,
): number {
  const spent = applyWarriorSkillResource(context, skill);
  const state = professionCoreState(context);
  if (skill.burst && spent > 0 && hasTrait(context, TRAIT.BURST_PRECISION)) {
    state.burstPrecisionDurations[context.reservationId] = spent >= 30 ? 4 : 2;
  }
  if (skill.burst && spent > 0 && hasTrait(context, TRAIT.BERSERKERS_POWER)) {
    const stacks =
      skill.primalBurst || context.config.specialization === "Spellbreaker"
        ? 2
        : spent >= 30
          ? 4
          : spent >= 20
            ? 3
            : 2;
    grantBerserkersPower(
      context,
      stacks,
      context.effectiveEnd + context.epsilon,
      skill,
    );
  }
  return spent;
}

function adjustResourceSkillEffect(
  context: WarriorCastContext,
  skill: WarriorSkill,
  event: WarriorSimulationEvent,
  handlerState: unknown,
): void {
  const spent = Number(handlerState || 0);
  if (
    skill.id === ID.BLOODTHIRSTER &&
    event.type === "condition" &&
    event.condition === "Bleeding"
  ) {
    const tier = spent >= 30 ? 3 : spent >= 20 ? 2 : 1;
    context.replaceEvent(event, { stacks: tier * 3 });
  }
  if (
    skill.id !== ID.EVISCERATE ||
    event.type !== "damage" ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  context.replaceEvent(event, {
    coefficient: spent >= 30 ? 3 : spent >= 20 ? 2.5 : 2,
    name: `Eviscerate — Level ${spent >= 30 ? 3 : spent >= 20 ? 2 : 1} Damage`,
  });
}

function swapWarriorWeapons(
  context: WarriorCastContext,
  skill: WarriorSkill,
): boolean {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  professionCoreState(context).autoattackChains = {};
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
    professionCoreState(context).soldierFocusReadyAt = context.effectiveEnd;
  }
  context.emit({
    type: "weapon_set",
    at: context.effectiveEnd,
    source: "warrior",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet,
  });
  return true;
}

function consumeDragonRoarAmmo(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const bullets = Math.max(1, Number(context.ammo?.charges || 1));
  if (context.state.profession.specialization.kind === "Bladesworn") {
    const state = context.state.profession.specialization.state;
    state.ammoRoundsSpentByActivation[context.reservationId] = bullets;
    state.ammoStartedFullByActivation[context.reservationId] =
      bullets >= Number(context.ammo?.maximum || skill.ammo || 0);
  }
  if (context.ammo && context.ammo.charges > 1) context.ammo.charges = 1;
  context.replaceEvent(context.action, {
    rechargeReadyAt:
      context.rechargeStart +
      Math.max(context.rechargeDuration, context.ammoLockoutDuration),
  });
  for (let hitIndex = 1; hitIndex <= bullets; hitIndex += 1) {
    context.emit({
      type: "damage",
      at: context.effectiveEnd,
      source: "Warrior",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Dragon's Roar — Damage per Bullet",
      coefficient: 0.75,
      hits: 1,
      hitIndex,
      totalHits: bullets,
      skillWeapon: "Pistol",
      damageKind: "explosion",
    });
  }
}

function restoreAmmo(
  context: WarriorCastContext,
  skill: WarriorSkill,
  count: number,
  at: number,
): number {
  const ammo = context.cooldownController.refreshAmmo(skill, at);
  if (!ammo) return 0;
  const missing = Math.max(0, ammo.maximum - ammo.charges);
  const restored = Math.min(missing, Math.max(0, count));
  if (!restored) return 0;

  const mirroredRecharge = ammo.nextRechargeAt;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  const lastAction = [...context.events]
    .reverse()
    .find((event) => event.type === "action" && event.skillId === skill.id);
  const lastActionEnd = Number(lastAction?.endsAt || 0);
  const lockoutReadyAt =
    lastActionEnd +
    context.rechargeDurationFor(skill, lastActionEnd, {
      ammoCastLockout: true,
    });
  if (
    ammo.charges === 0 &&
    mirroredRecharge != null &&
    readyAt <= mirroredRecharge + context.epsilon
  ) {
    context.state.cooldowns.delete(skill.id);
  }
  ammo.charges += restored;
  if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
  context.cooldownController.refreshAmmo(skill, at);
  if (lockoutReadyAt > at + context.epsilon) {
    context.state.cooldowns.set(skill.id, lockoutReadyAt);
  }
  return restored;
}

export function completeWarriorSkill(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const at = context.effectiveEnd;
  if (
    skill.categories?.includes("Signet") &&
    hasTrait(context, TRAIT.SIGNET_MASTERY)
  ) {
    context.emit({
      type: "buff",
      at: at + context.epsilon,
      source: "Trait",
      sourceId: TRAIT.SIGNET_MASTERY,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Signet Mastery",
      kind: "signet-mastery",
      stacks: 1,
      duration: 60,
    });
  }
  if (skill.id === ID.TREMOR) {
    context.state.cooldowns.delete(ID.CRUSHING_BLOW);
  }
  if (
    context.config.specialization === "Bladesworn" &&
    skill.id === ID.GUNSTINGER
  ) {
    const dragonsRoar = context.catalog.skillsById.get(ID.DRAGONS_ROAR);
    if (dragonsRoar) restoreAmmo(context, dragonsRoar, 3, at);
  }
  if (
    skill.categories?.includes("Physical") &&
    hasTrait(context, TRAIT.PEAK_PERFORMANCE)
  ) {
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.PEAK_PERFORMANCE,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Peak Performance",
      kind: "peak-performance",
      stacks: 1,
      duration: 6,
    });
  }
  if (skill.shadowstepSkill && context.config.relic === "Peitha") {
    context.emit({
      type: "peitha",
      at,
      source: "Warrior",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Relic of Peitha",
    });
  }
  if (
    MOVEMENT_SKILL_IDS.has(Number(skill.id)) &&
    hasTrait(context, TRAIT.BRAVE_STRIDE)
  ) {
    gainWarriorAdrenaline(context, 5);
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.BRAVE_STRIDE,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Brave Stride",
      kind: "stability",
      boon: "stability",
      stacks: 1,
      duration: 5,
    });
  }
  if (
    skill.dragonSlash &&
    context.state.profession.specialization.kind === "Bladesworn"
  ) {
    const state = context.state.profession.specialization.state;
    const charges = Math.max(
      0,
      Number(state.dragonChargesSpentByActivation[context.reservationId] || 0),
    );
    const stacks = charges >= 10 ? 4 : charges >= 5 ? 3 : 2;
    grantBerserkersPower(context, stacks, at + context.epsilon, skill);
    delete state.dragonChargesSpentByActivation[context.reservationId];
  }
}

function performWarriorDodge(
  context: WarriorCastContext,
  skill: WarriorSkill,
): boolean {
  const state = professionCoreState(context);
  state.endurance = Math.max(0, state.endurance - 50);
  state.enduranceUpdatedAt = context.start;
  if (hasTrait(context, TRAIT.RECKLESS_DODGE)) {
    context.emit({
      type: "damage",
      at: context.effectiveEnd,
      source: "Warrior",
      sourceId: TRAIT.RECKLESS_DODGE,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Reckless Dodge",
      coefficient: 1.5,
    });
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.RECKLESS_DODGE,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Reckless Dodge — Might",
      kind: "might",
      boon: "might",
      stacks: 2,
      duration: 5,
    });
  }
  return true;
}

export const warriorCoreSkillHandlers = Object.freeze({
  "warrior.resource": augmentSkillHandler(afterResourceSkill, {
    afterEffect: adjustResourceSkillEffect,
  }),
  "warrior.weapon-swap": replaceSkillHandler(swapWarriorWeapons),
  "warrior.gunstinger": augmentSkillHandler(null),
  "warrior.dragons-roar": replaceSkillHandler(consumeDragonRoarAmmo),
  "warrior.dodge": replaceSkillHandler(performWarriorDodge),
});

const BODY_BLOW_CONTROL_KINDS = new Set([
  "stun",
  "daze",
  "knockback",
  "pull",
  "push",
  "launch",
]);

function armsCriticalCount(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): number {
  const hits = Math.max(1, Number(event.hits || 1));
  if (context.config.randomness?.mode === "stochastic") {
    if (typeof event.didCrit !== "boolean") {
      throw new Error(
        `Missing sampled critical outcome for Warrior event ${String(
          event.skillName || event.name || event.sourceId,
        )}.`,
      );
    }
    return event.didCrit ? hits : 0;
  }
  const state = professionCoreState(context);
  const criticalPolicy = context.schedulerPolicy as unknown as {
    critical?: (
      schedulerContext: WarriorSchedulerContext,
      simulationEvent: WarriorSimulationEvent,
    ) => { chance?: number };
  };
  const chance = Number(criticalPolicy.critical?.(context, event)?.chance || 0);
  state.armsCriticalProgress += chance * hits;
  const count = Math.floor(state.armsCriticalProgress + 1e-9);
  state.armsCriticalProgress -= count;
  return count;
}

function applyArmsCriticalTraits(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
  firstBurstHit: boolean,
): void {
  const criticals = armsCriticalCount(context, event);
  if (criticals > 0 && event.skillId === ID.KEEN_STRIKE) {
    emitTraitBoon(
      context,
      event,
      ID.KEEN_STRIKE,
      "Keen Strike — Critical Might",
      "might",
      5,
    );
  }
  const state = professionCoreState(context);
  if (hasTrait(context, TRAIT.BLOODLUST) && criticals > 0) {
    state.bloodlustProgress += criticals * 0.33;
    const bleeding = Math.floor(state.bloodlustProgress + 1e-9);
    state.bloodlustProgress -= bleeding;
    if (bleeding > 0) {
      context.emitDerived(event, {
        type: "condition",
        at: event.at,
        source: "Trait",
        sourceId: TRAIT.BLOODLUST,
        actorType: "effect",
        skillId: event.skillId,
        skillName: event.skillName,
        name: "Bloodlust — Bleeding",
        condition: "Bleeding",
        stacks: bleeding,
        duration: 3,
      });
    }
  }
  if (hasTrait(context, TRAIT.FURIOUS) && criticals > 0) {
    gainWarriorAdrenaline(context, criticals);
    context.emitDerived(event, {
      type: "buff",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.FURIOUS,
      actorType: "effect",
      skillId: event.skillId,
      skillName: event.skillName,
      name: "Furious Surge",
      kind: "furious-surge",
      stacks: criticals,
      duration: 10,
    });
  }
  if (
    firstBurstHit &&
    hasTrait(context, TRAIT.SUNDERING_BURST) &&
    event.at + context.epsilon >=
      Number(state.traitProcReadyAt.sunderingBurst || 0)
  ) {
    state.traitProcReadyAt.sunderingBurst = event.at + 5;
    context.emitDerived(event, {
      type: "condition",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.SUNDERING_BURST,
      actorType: "effect",
      skillId: event.skillId,
      skillName: event.skillName,
      name: "Sundering Burst — Vulnerability",
      condition: "Vulnerability",
      stacks: criticals > 0 ? 10 : 5,
      duration: 8,
    });
  }
}

export function initializeWarriorTraits(
  context: WarriorSchedulerContext,
): void {
  const weapons = [
    context.config.primaryWeapon,
    context.config.secondaryWeapon,
    context.config.weaponSet2Primary,
    context.config.weaponSet2Secondary,
  ].map(String);
  if (
    weapons.includes("Dagger") ||
    hasTrait(context, TRAIT.BLOODLUST) ||
    hasTrait(context, TRAIT.FURIOUS) ||
    hasTrait(context, TRAIT.SUNDERING_BURST)
  ) {
    (
      context.schedulerPolicy as unknown as {
        requireCriticalFacts?: () => void;
      }
    ).requireCriticalFacts?.();
  }
}

export function handleWarriorArmsCriticalTask(
  context: WarriorSchedulerContext,
  task: ScheduledTask,
): void {
  const payload = task.payload as {
    readonly eventOrder?: number;
    readonly firstBurstHit?: boolean;
  } | null;
  const event = context.events.find(
    (candidate) => candidate.__order === Number(payload?.eventOrder),
  ) as WarriorSimulationEvent | undefined;
  if (!event) return;
  applyArmsCriticalTraits(context, event, Boolean(payload?.firstBurstHit));
}

function emitTraitBoon(
  context: WarriorSchedulerContext,
  cause: WarriorSimulationEvent,
  traitId: number,
  name: string,
  boon: string,
  duration: number,
  stacks = 1,
  recipients: "party" | "allies" | "self" = "self",
): void {
  context.emitDerived(cause, {
    type: "buff",
    at: cause.at,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    skillId: cause.skillId,
    skillName: cause.skillName,
    name,
    kind: boon,
    boon,
    duration,
    stacks,
    recipients,
    ...(recipients === "allies" ? { affectsSelf: false } : {}),
  });
}

export function observeWarriorEvent(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  const state = professionCoreState(context);
  if (event.type === "combat_start") {
    state.signetOfRageNextAt = event.at + 3;
  }
  const opportunistTrigger =
    (event.type === "control" && event.actorType === "player") ||
    (event.type === "condition" &&
      event.actorType === "player" &&
      event.condition === "Immobilized");
  if (
    opportunistTrigger &&
    hasTrait(context, TRAIT.OPPORTUNIST) &&
    event.at + context.epsilon >=
      Number(state.traitProcReadyAt.opportunist || 0)
  ) {
    state.traitProcReadyAt.opportunist = event.at + 1;
    gainWarriorAdrenaline(context, 5);
    emitTraitBoon(context, event, TRAIT.OPPORTUNIST, "Opportunist", "fury", 3);
  }
  if (event.type === "control" && event.actorType === "player") {
    state.targetControlledUntil = Math.max(
      state.targetControlledUntil,
      event.at + Number(event.duration || 1),
    );
    if (
      hasTrait(context, TRAIT.BODY_BLOW) &&
      BODY_BLOW_CONTROL_KINDS.has(String(event.controlKind || "").toLowerCase())
    ) {
      for (const [condition, duration] of [
        ["Weakness", 3],
        ["Vulnerability", 6],
      ] as const) {
        context.emitDerived(event, {
          type: "condition",
          at: event.at,
          source: "Trait",
          sourceId: TRAIT.BODY_BLOW,
          actorType: "effect",
          skillId: event.skillId,
          skillName: event.skillName,
          name: `Body Blow — ${condition}`,
          condition,
          stacks: 1,
          duration,
        });
      }
    }
    if (hasTrait(context, TRAIT.AGGRESSIVE_ONSLAUGHT)) {
      const readyAt = Number(state.traitProcReadyAt.aggressiveOnslaught || 0);
      if (event.at + context.epsilon >= readyAt) {
        state.traitProcReadyAt.aggressiveOnslaught = event.at + 0.25;
        emitTraitBoon(
          context,
          event,
          TRAIT.AGGRESSIVE_ONSLAUGHT,
          "Aggressive Onslaught",
          "quickness",
          3,
        );
      }
    }
  }
  if (
    event.type === "condition" &&
    event.condition === "Crippled" &&
    hasTrait(context, TRAIT.LEG_SPECIALIST)
  ) {
    context.emitDerived(event, {
      type: "condition",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.LEG_SPECIALIST,
      actorType: "effect",
      skillId: event.skillId,
      skillName: event.skillName,
      name: "Leg Specialist — Immobilized",
      condition: "Immobilized",
      stacks: 1,
      duration: 1,
    });
  }
  if (
    event.type === "buff" &&
    event.kind === "might" &&
    event.affectsSelf !== false &&
    event.sourceId !== TRAIT.PHALANX_STRENGTH &&
    hasTrait(context, TRAIT.PHALANX_STRENGTH)
  ) {
    emitTraitBoon(
      context,
      event,
      TRAIT.PHALANX_STRENGTH,
      "Phalanx Strength",
      "might",
      5,
      1,
      "allies",
    );
  }
  if (
    event.type === "damage" &&
    event.actorType === "player" &&
    Number(event.coefficient) > 0
  ) {
    const skill =
      event.skillId == null
        ? undefined
        : context.catalog.skillsById.get(event.skillId);
    if (skill?.burst) {
      const activationKey = String(
        event.activationId || `${event.skillId}:${event.at}`,
      );
      if (!state.burstHitActivations[activationKey]) {
        state.burstHitActivations[activationKey] = true;
        if (hasTrait(context, TRAIT.BURST_PRECISION)) {
          const duration = Number(
            state.burstPrecisionDurations[activationKey] ||
              (Number(skill.burstTier || 1) >= 3 ? 4 : 2),
          );
          delete state.burstPrecisionDurations[activationKey];
          context.emitDerived(event, {
            type: "buff",
            at: event.at,
            source: "Trait",
            sourceId: TRAIT.BURST_PRECISION,
            actorType: "effect",
            skillId: event.skillId,
            skillName: event.skillName,
            name: "Burst Precision",
            kind: "burst-precision",
            stacks: 1,
            duration,
          });
        }
        if (hasTrait(context, TRAIT.BUILDING_MOMENTUM)) {
          gainWarriorEndurance(context, 15, event.at);
        }
        if (
          hasTrait(context, TRAIT.MARCHING_ORDERS) &&
          event.at + context.epsilon >= state.soldierFocusReadyAt
        ) {
          state.soldierFocusReadyAt = event.at + 10;
          emitTraitBoon(
            context,
            event,
            TRAIT.MARCHING_ORDERS,
            "Soldier's Focus — Might",
            "might",
            15,
            3,
            "party",
          );
          if (hasTrait(context, TRAIT.SOLDIERS_COMFORT)) {
            emitTraitBoon(
              context,
              event,
              TRAIT.SOLDIERS_COMFORT,
              "Soldier's Comfort",
              "protection",
              4,
              1,
              "party",
            );
          }
          if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
            emitTraitBoon(
              context,
              event,
              TRAIT.MARTIAL_CADENCE,
              "Martial Cadence",
              "stability",
              3,
              1,
              "party",
            );
          }
        }
      }
    }
    const armsActivationKey = String(
      event.activationId || `${event.skillId}:${event.at}`,
    );
    const armsBurstKey = `arms:${armsActivationKey}`;
    const firstBurstHit =
      Boolean(skill?.burst) && !state.burstHitActivations[armsBurstKey];
    if (firstBurstHit) state.burstHitActivations[armsBurstKey] = true;
    const tracksArmsCritical =
      event.skillId === ID.KEEN_STRIKE ||
      hasTrait(context, TRAIT.BLOODLUST) ||
      hasTrait(context, TRAIT.FURIOUS) ||
      (firstBurstHit && hasTrait(context, TRAIT.SUNDERING_BURST));
    if (tracksArmsCritical) {
      context.tasks.schedule({
        type: "warrior.arms-critical",
        at: Math.max(context.state.time, event.at),
        priority: -40,
        payload: {
          eventOrder: Number(event.__order),
          firstBurstHit,
        },
      });
    }
  }
  if (
    context.config.specialization === "Bladesworn" ||
    event.type !== "damage" ||
    (event.actorType !== "player" && event.source !== "Sigil") ||
    !(Number(event.coefficient) > 0)
  )
    return;
  context.tasks.schedule({
    type: "warrior.adrenaline-hit",
    at: event.at,
    payload: { amount: Math.max(1, Number(event.hits || 1)) },
  });
}

export function advanceWarriorTraits(
  context: WarriorSchedulerContext,
  target: number,
): void {
  const state = professionCoreState(context);
  const selectedSkills = context.config.selectedSkills || [];
  const selected = Array.isArray(selectedSkills)
    ? selectedSkills
    : Object.values(selectedSkills);
  if (selected.map(String).includes("Signet of Rage")) {
    while (
      state.signetOfRageNextAt > 0 &&
      state.signetOfRageNextAt <= target + context.epsilon
    ) {
      const at = state.signetOfRageNextAt;
      const cooldownReadyAt = Number(
        context.state.cooldowns.get(ID.SIGNET_OF_RAGE) || 0,
      );
      if (cooldownReadyAt <= at + context.epsilon)
        gainWarriorAdrenaline(context, 2);
      state.signetOfRageNextAt += 3;
    }
  }
  if (!hasTrait(context, TRAIT.EMPOWER_ALLIES)) return;
  while (state.empowerAlliesNextAt <= target + context.epsilon) {
    const at = state.empowerAlliesNextAt;
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.EMPOWER_ALLIES,
      actorType: "effect",
      name: "Empower Allies",
      kind: "might",
      boon: "might",
      stacks: 5,
      duration: 10,
      recipients: "party",
    });
    state.empowerAlliesNextAt += 10;
  }
}

export function updateWarriorCastState(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const state = professionCoreState(context);
  if (skill.id === -3 && hasTrait(context, TRAIT.VERSATILE_RAGE)) {
    gainWarriorAdrenaline(context, 5);
  }
  if (
    skill.id === -3 &&
    hasTrait(context, TRAIT.FURIOUS_BURST) &&
    context.effectiveEnd + context.epsilon >=
      Number(state.traitProcReadyAt.furiousBurst || 0)
  ) {
    state.traitProcReadyAt.furiousBurst = context.effectiveEnd + 4;
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.FURIOUS_BURST,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Furious Burst",
      kind: "fury",
      boon: "fury",
      stacks: 1,
      duration: 2.5,
    });
  }
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon" || skill.gunsaberSkill) {
    state.autoattackChains = {};
  }
}
