import { hasTrait as hasGw2Trait } from "../../../../platform/gw2/trait-state.js";
import type {
  AvailabilityResult,
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
  Skill,
} from "../../../../platform/engine/types.js";
import {
  emitElementalistBuff,
  emitElementalistProc,
  grantElementalistRockSolid,
  triggerElementalistEarthenBlast,
  triggerElementalistElectricDischarge,
  triggerElementalistSunspot,
} from "../../core/rules.js";
import {
  elementalistCoreState,
  type ElementalistAttunement,
} from "../../core/state.js";
import { evokerState, type EvokerState } from "./state.js";

export const FAMILIAR_ELEMENTS: Readonly<
  Record<string, ElementalistAttunement>
> = Object.freeze({
  Ignite: "Fire",
  Conflagration: "Fire",
  Splash: "Water",
  "Buoyant Deluge": "Water",
  Zap: "Air",
  "Lightning Blitz": "Air",
  Calcify: "Earth",
  "Seismic Impact": "Earth",
});
const BASIC_FAMILIARS = new Set(["Ignite", "Splash", "Zap", "Calcify"]);
const EVOKER_NO_CHARGE_SKILLS = new Set([
  "Transmute Earth",
  "Hurl",
  "Transmute Frost",
  "Transmute Lightning",
  "Transmute Fire",
  "Grand Finale",
]);
const ELECTRIC_ENCHANTMENT_ICON =
  "https://wiki.guildwars2.com/images/7/7b/Hare%27s_Agility.png";
const CONJURED_WEAPONS = new Set([
  "Frost Bow",
  "Lightning Hammer",
  "Fiery Greatsword",
]);
const FULL_SPEAR_ETCHINGS = new Set([
  "Volcano",
  "Jökulhlaup",
  "Derecho",
  "Haboob",
]);
const FAMILIAR_FLIP_DELAYS: Readonly<
  Record<string, readonly [string, number]>
> = Object.freeze({
  Ignite: ["Conflagration", 0.96],
  Zap: ["Lightning Blitz", 0.68],
  Splash: ["Buoyant Deluge", 0.84],
  Calcify: ["Seismic Impact", 0.28],
});
const FAMILIAR_INTERRUPT_WINDOWS: Readonly<
  Record<string, readonly [string, number]>
> = Object.freeze({
  Ignite: ["Conflagration", 2.4],
  Zap: ["Lightning Blitz", 2.3],
  Splash: ["Buoyant Deluge", 2.4],
  Calcify: ["Seismic Impact", 2.2],
});
const FAMILIAR_BASIC_BY_EMPOWERED = Object.freeze(
  Object.fromEntries(
    Object.entries(FAMILIAR_INTERRUPT_WINDOWS).map(([basic, [empowered]]) => [
      empowered,
      basic,
    ]),
  ) as Readonly<Record<string, string>>,
);

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

function availability(
  context: CastContext<SchedulerRecord>,
  skill: Skill,
): AvailabilityResult {
  const element = FAMILIAR_ELEMENTS[skill.name];
  if (!element) return { ready: true };
  const state = evokerState.from(context);
  if (state.element !== element) {
    return {
      ready: false,
      retryAt: null,
      code: "elementalist.evoker-element",
      reason: `${skill.name} is unavailable — the ${element} familiar is not selected.`,
    };
  }
  if (BASIC_FAMILIARS.has(skill.name)) {
    return state.empowered < 3 && state.charges >= state.maximumCharges
      ? { ready: true }
      : {
          ready: false,
          retryAt: null,
          code: "elementalist.evoker-basic",
          reason: `${skill.name} is unavailable — requires ${state.maximumCharges} charges and no empowered familiar.`,
        };
  }
  return state.empowered >= 3
    ? { ready: true }
    : {
        ready: false,
        retryAt: null,
        code: "elementalist.evoker-empowered",
        reason: `${skill.name} is unavailable — requires three empowered charges.`,
      };
}

function emitResource(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
  state: EvokerState,
): void {
  context.emit({
    type: "resource",
    at: context.effectiveEnd,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillName: skill.name,
    kind: "evoker-charges",
    value: state.charges,
    maximum: state.maximumCharges,
    empowered: state.empowered,
  });
}

function releaseElementalProcession(
  context: CastLifecycleContext<SchedulerRecord>,
  sourceSkill: Skill,
): void {
  for (const name of ["Conflagration", "Lightning Blitz", "Seismic Impact"]) {
    const familiar = context.catalog.skillsByName.get(name);
    if (!familiar) continue;
    for (const rawEffect of familiar.effects || []) {
      const effect = rawEffect as SchedulerRecord;
      const ticks = Array.isArray(effect.ticks) ? effect.ticks : [effect];
      for (const rawTick of ticks) {
        const tick = rawTick as SchedulerRecord;
        const at =
          context.effectiveEnd + Number(tick.atMs ?? effect.atMs ?? 0) / 1_000;
        const metadata = (tick.metadata ||
          effect.metadata ||
          {}) as SchedulerRecord;
        if (effect.type === "strike") {
          context.emit({
            type: "damage",
            at,
            source: name,
            sourceId: familiar.id,
            actorType: "player",
            skillName: name,
            skillId: familiar.id,
            coefficient: Number(tick.coefficient ?? effect.coefficient ?? 0),
            skillWeapon: "Unequipped",
            canCrit: effect.canCrit !== false,
            finisherType: metadata.finisherType,
            finisherValue: metadata.finisherValue,
            triggeredBy: sourceSkill.name,
          });
        } else if (effect.type === "condition") {
          context.emit({
            type: "condition",
            at,
            source: name,
            sourceId: familiar.id,
            actorType: "player",
            skillName: name,
            skillId: familiar.id,
            condition: String(tick.condition || effect.condition || ""),
            stacks: Number(tick.stacks ?? effect.stacks ?? 1),
            duration: Number(tick.duration ?? effect.duration ?? 0),
            triggeredBy: sourceSkill.name,
          });
        } else if (effect.type === "control" || effect.type === "blind") {
          context.emit({
            type: String(effect.type),
            at,
            source: name,
            sourceId: familiar.id,
            actorType: "player",
            skillName: name,
            skillId: familiar.id,
            controlKind: metadata.controlKind,
            finisherType: metadata.finisherType,
            finisherValue: metadata.finisherValue,
            triggeredBy: sourceSkill.name,
          });
        }
      }
    }
  }
}

function grantWeaponSkillCharges(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
  state: EvokerState,
): void {
  const slot = /^Weapon_(\d)$/.exec(String(skill.slot || ""));
  if (
    skill.type !== "Weapon" ||
    !slot ||
    Number(slot[1]) < 2 ||
    Number(slot[1]) > 5 ||
    CONJURED_WEAPONS.has(String(skill.skillWeapon || skill.weapon || "")) ||
    EVOKER_NO_CHARGE_SKILLS.has(skill.name) ||
    (skill.weapon === "Spear" &&
      (skill.name.startsWith("Lesser ") || FULL_SPEAR_ETCHINGS.has(skill.name)))
  ) {
    return;
  }
  const before = state.charges;
  const gain = String(skill.attunement || "")
    .split("+")
    .includes(state.element)
    ? 2
    : 1;
  state.charges = Math.min(state.maximumCharges, state.charges + gain);
  if (state.charges === before) return;
  context.emit({
    type: "resource",
    at: context.effectiveEnd,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillName: skill.name,
    kind: "evoker-charges",
    value: state.charges,
    maximum: state.maximumCharges,
    empowered: state.empowered,
    change: state.charges - before,
  });
}

function cancelActivationEffects(
  context: SchedulerContext<SchedulerRecord>,
  activationId: string,
  from: number,
): void {
  for (const event of [...context.events]) {
    if (
      event.activationId === activationId &&
      event.at >= from &&
      event.type !== "action"
    ) {
      context.replaceEvent(event, {
        type: "marker",
        cancelled: true,
        detail: "cancelled by familiar flip interaction",
      });
    }
  }
}

function onCastStart(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  const state = evokerState.from(context);
  const interrupt = FAMILIAR_INTERRUPT_WINDOWS[skill.name];
  if (interrupt) {
    const [empoweredSkill, window] = interrupt;
    const recent = state.lastEmpoweredFamiliarByBasic[skill.name];
    if (
      recent?.skill === empoweredSkill &&
      context.start - recent.start < window
    ) {
      cancelActivationEffects(context, recent.activationId, context.start);
      state.cancelledFamiliarActivations[context.reservationId] = true;
      const core = elementalistCoreState(context as unknown as SchedulerRecord);
      core.activeComboFields = core.activeComboFields.filter(
        (field) =>
          field.skillName !== empoweredSkill || field.startsAt < context.start,
      );
      state.lastEmpoweredFamiliarByBasic[skill.name] = null;
    }
  }

  const basic = FAMILIAR_BASIC_BY_EMPOWERED[skill.name];
  if (basic) {
    state.lastEmpoweredFamiliarByBasic[basic] = {
      skill: skill.name,
      activationId: context.reservationId,
      start: context.start,
    };
  }
}

function afterCast(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  const state = evokerState.from(context);
  if (state.cancelledFamiliarActivations[context.reservationId]) {
    cancelActivationEffects(context, context.reservationId, context.start);
    delete state.cancelledFamiliarActivations[context.reservationId];
    return;
  }
  if (skill.name === "Ignite") {
    if (context.start - state.igniteLastUsedAt >= 15) state.igniteTier = 0;
    const durations = [2, 0.5, 1, 1.5];
    for (const event of context.events) {
      if (
        event.activationId === context.reservationId &&
        event.type === "condition" &&
        event.condition === "Burning"
      ) {
        context.replaceEvent(event, { duration: durations[state.igniteTier] });
      }
    }
    state.igniteTier = (state.igniteTier + 1) % durations.length;
    state.igniteLastUsedAt = context.start;
  }
  if (skill.name === "Fox's Fury") {
    const might = context.buffStacks("might", context.start);
    const tier = might >= 20 ? 2 : might >= 10 ? 1 : 0;
    const at =
      context.start +
      0.56 / (context.hasBuff("quickness", context.start) ? 1.5 : 1);
    context.emit({
      type: "damage",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      skillId: skill.id,
      coefficient: [1.5, 2.25, 3][tier],
      skillWeapon: "Unequipped",
    });
    context.emit({
      type: "condition",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      skillId: skill.id,
      condition: "Burning",
      stacks: [1, 2, 3][tier],
      duration: [3, 5, 7][tier],
    });
  }
}

function grantFamiliarProwess(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  const at = context.effectiveEnd;
  const current = context.events
    .filter(
      (event) =>
        event.type === "buff" &&
        event.kind === "familiar's-prowess" &&
        event.at <= at &&
        event.at + Number(event.duration || 0) > at,
    )
    .at(-1);
  if (current) {
    const expiry = current.at + Number(current.duration || 0);
    context.replaceEvent(current, {
      duration: Math.min(expiry + 5, at + 15) - current.at,
    });
    return;
  }
  context.emit({
    type: "buff",
    at,
    source: "Familiar's Prowess",
    sourceId: skill.id,
    actorType: "player",
    skillName: "Familiar's Prowess",
    kind: "familiar's-prowess",
    stacks: 1,
    duration: 5,
  });
}

function rechargeWeaponSkills(
  context: CastLifecycleContext<SchedulerRecord>,
  percentage: number,
): void {
  const at = context.effectiveEnd;
  for (const candidate of context.catalog.skills) {
    if (candidate.type !== "Weapon") continue;
    const reduction = context.rechargeDurationFor(candidate, at) * percentage;
    const readyAt = Number(context.state.cooldowns.get(candidate.id) || 0);
    if (readyAt > at) {
      context.state.cooldowns.set(
        candidate.id,
        Math.max(at, readyAt - reduction),
      );
    }
    context.cooldownController.reduceAmmoRecharge(candidate, reduction, at);
  }
}

function triggerSpecializedElementEntry(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
  element: ElementalistAttunement,
): void {
  const at = context.effectiveEnd;
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  context.emit({
    type: "elementalist.attunement-enter",
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillName: skill.name,
    to: element,
  });
  if (element === "Fire") {
    triggerElementalistSunspot(context as never, at, skill.id);
  } else if (element === "Air") {
    triggerElementalistElectricDischarge(context as never, at, skill.id);
    if (hasTrait(context, "One with Air")) {
      emitElementalistBuff(
        context as never,
        at,
        "Superspeed",
        1,
        3,
        skill.name,
        skill.id,
      );
    }
    if (hasTrait(context, "Inscription")) {
      emitElementalistBuff(
        context as never,
        at,
        "Resistance",
        1,
        3,
        skill.name,
        skill.id,
      );
    }
    if (hasTrait(context, "Fresh Air")) {
      emitElementalistBuff(
        context as never,
        at,
        "Fresh Air",
        1,
        5,
        skill.name,
        skill.id,
      );
    }
  } else if (element === "Water" && hasTrait(context, "Latent Stamina")) {
    if (Number(core.procReadyAt.latentStamina || 0) <= at + context.epsilon) {
      core.procReadyAt.latentStamina = at + 10;
      emitElementalistBuff(
        context as never,
        at,
        "Vigor",
        1,
        3,
        "Latent Stamina",
        skill.id,
      );
    }
  } else if (element === "Earth") {
    triggerElementalistEarthenBlast(context as never, at, skill.id);
    grantElementalistRockSolid(context as never, at, skill.id);
  }
}

function emitElectricEnchantment(
  context: SchedulerContext<SchedulerRecord>,
  event: SimulationEvent,
): void {
  context.emitDerived(event, {
    type: "damage",
    at: event.at,
    source: "Electric Enchantment",
    sourceId: event.skillId ?? event.sourceId,
    actorType: "effect",
    skillName: "Electric Enchantment",
    coefficient: 0.4,
    skillWeapon: "Unequipped",
  });
  context.emitDerived(event, {
    type: "condition",
    at: event.at,
    source: "Electric Enchantment",
    sourceId: event.skillId ?? event.sourceId,
    actorType: "effect",
    skillName: "Electric Enchantment",
    condition: "Burning",
    stacks: 1,
    duration: 1.5,
  });
  emitElementalistProc(context as never, {
    at: event.at,
    name: "Electric Enchantment",
    procType: "trait",
    sourceId: event.skillId ?? event.sourceId,
    sourceSkill: String(event.skillName || event.source || ""),
    icon: ELECTRIC_ENCHANTMENT_ICON,
  });
}

function materializeArmedElectricEnchantments(
  context: CastLifecycleContext<SchedulerRecord>,
  state: EvokerState,
): void {
  const candidates = context.events
    .filter(
      (event) =>
        event.type === "damage" &&
        event.actorType === "player" &&
        Number(event.coefficient || 0) > 0 &&
        event.at >= context.effectiveEnd &&
        event.electricEnchantmentConsumed !== true,
    )
    .sort((left, right) => left.at - right.at);
  for (const event of candidates) {
    if (state.electricEnchantmentStacks <= 0) break;
    state.electricEnchantmentStacks -= 1;
    context.replaceEvent(event, { electricEnchantmentConsumed: true });
    emitElectricEnchantment(context, event);
  }
}

function onCastComplete(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  const state = evokerState.from(context);
  const at = context.effectiveEnd;
  grantWeaponSkillCharges(context, skill, state);
  if (
    FAMILIAR_ELEMENTS[skill.name] &&
    hasTrait(context, "Familiar's Prowess")
  ) {
    grantFamiliarProwess(context, skill);
  }
  const familiarElement = FAMILIAR_ELEMENTS[skill.name];
  if (familiarElement && hasTrait(context, "Familiar's Blessing")) {
    const quick = familiarElement === "Fire" || familiarElement === "Air";
    emitElementalistBuff(
      context as never,
      at,
      quick ? "Quickness" : "Alacrity",
      1,
      quick ? 1.75 : 4,
      "Familiar's Blessing",
      skill.id,
    );
  }
  if (familiarElement && hasTrait(context, "Galvanic Enchantment")) {
    state.electricEnchantmentStacks += 2;
    emitElementalistProc(context as never, {
      at,
      name: "Electric Enchantment",
      procType: "trait",
      sourceId: skill.id,
      sourceSkill: skill.name,
      detail: "+2 stacks",
      icon: ELECTRIC_ENCHANTMENT_ICON,
    });
  }
  if (skill.name === "Lightning Blitz") {
    state.electricEnchantmentStacks += 1;
    emitElementalistProc(context as never, {
      at,
      name: "Electric Enchantment",
      procType: "skill",
      sourceId: skill.id,
      sourceSkill: skill.name,
      detail: "+1 stack",
      icon: ELECTRIC_ENCHANTMENT_ICON,
    });
  }
  if (familiarElement) {
    materializeArmedElectricEnchantments(context, state);
  }
  if (skill.name === "Zap") {
    context.emit({
      type: "buff",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      kind: "zap buff",
      stacks: 1,
      duration: 5,
    });
  }
  if (BASIC_FAMILIARS.has(skill.name)) {
    state.charges = 0;
    state.empowered = Math.min(3, state.empowered + 1);
    const flip = FAMILIAR_FLIP_DELAYS[skill.name];
    const empowered = flip
      ? context.catalog.skillsByName.get(flip[0])
      : undefined;
    if (flip && empowered) {
      context.state.cooldowns.set(
        empowered.id,
        Math.max(
          Number(context.state.cooldowns.get(empowered.id) || 0),
          at + flip[1],
        ),
      );
    }
    emitResource(context, skill, state);
  } else if (FAMILIAR_ELEMENTS[skill.name]) {
    state.empowered = 0;
    emitResource(context, skill, state);
  } else if (skill.name === "Rejuvenate") {
    state.charges = state.maximumCharges;
    emitResource(context, skill, state);
  }
  if (skill.name === "Elemental Procession") {
    releaseElementalProcession(context, skill);
  }
  if (skill.name === "Hare's Agility") {
    state.electricEnchantmentStacks += 5;
    emitElementalistProc(context as never, {
      at,
      name: "Electric Enchantment",
      procType: "skill",
      sourceId: skill.id,
      sourceSkill: skill.name,
      detail: "+5 stacks",
      icon: ELECTRIC_ENCHANTMENT_ICON,
    });
  } else if (skill.name === "Toad's Fortitude" && state.element === "Earth") {
    emitElementalistBuff(
      context as never,
      at,
      "Resistance",
      1,
      4,
      skill.name,
      skill.id,
    );
  } else if (skill.name === "Fox's Fury") {
    emitElementalistBuff(
      context as never,
      at,
      "Might",
      8 + (state.element === "Fire" ? 3 : 0),
      10,
      skill.name,
      skill.id,
    );
    emitElementalistBuff(
      context as never,
      at,
      "Fury",
      1,
      10,
      skill.name,
      skill.id,
    );
  }

  if (familiarElement && hasTrait(context, "Specialized Elements")) {
    rechargeWeaponSkills(context, BASIC_FAMILIARS.has(skill.name) ? 0.1 : 0.33);
    if (!BASIC_FAMILIARS.has(skill.name)) {
      triggerSpecializedElementEntry(context, skill, familiarElement);
    }
  }
}

function onEventScheduled(
  context: SchedulerContext<SchedulerRecord>,
  event: SimulationEvent,
): void {
  const state = evokerState.from(context);
  if (
    event.type === "condition" &&
    event.condition === "Burning" &&
    state.element === "Fire" &&
    state.ignitePassiveReadyAt <= event.at + context.epsilon
  ) {
    state.ignitePassiveReadyAt = event.at + 1;
    emitElementalistBuff(
      context as never,
      event.at,
      "Might",
      1,
      6,
      "Fire Familiar",
      event.skillId ?? event.sourceId,
    );
  }
  if (
    event.type === "damage" &&
    event.actorType === "player" &&
    Number(event.coefficient) > 0
  ) {
    if (state.electricEnchantmentStacks > 0) {
      state.electricEnchantmentStacks -= 1;
      context.replaceEvent(event, { electricEnchantmentConsumed: true });
      emitElectricEnchantment(context, event);
    }
  }
  if (event.type === "elementalist.evasive-arcana") {
    const attunement = String(event.attunement || "");
    if (attunement === "Air") return;
    const before = state.charges;
    const gain = state.element === attunement ? 2 : 1;
    state.charges = Math.min(state.maximumCharges, state.charges + gain);
    if (state.charges === before) return;
    context.emitDerived(event, {
      type: "resource",
      at: event.at,
      source: "Evasive Arcana",
      sourceId: event.sourceId,
      actorType: "player",
      skillName: "Evasive Arcana",
      kind: "evoker-charges",
      value: state.charges,
      maximum: state.maximumCharges,
      empowered: state.empowered,
      change: state.charges - before,
    });
    return;
  }
  if (
    event.type !== "elementalist.attunement" &&
    event.type !== "elementalist.attunement-enter"
  ) {
    return;
  }
  if (event.to !== state.element) return;
  if (hasTrait(context, "Elemental Balance")) {
    state.elementalBalanceProgress += 1;
    if (state.elementalBalanceProgress >= 2) {
      state.elementalBalanceProgress -= 2;
      state.elementalBalanceUntil = event.at + 5;
      emitElementalistProc(context as never, {
        at: event.at,
        name: "Elemental Balance",
        procType: "skill",
        sourceId: event.skillId ?? event.sourceId,
        sourceSkill: String(event.skillName || event.source || ""),
        detail: "CDR armed (5s)",
        icon: "https://wiki.guildwars2.com/images/4/4c/Elemental_Balance.png",
      });
    }
  }
  if (!hasTrait(context, "Elemental Dynamo")) return;
  state.charges = Math.min(state.maximumCharges, state.charges + 1);
  context.emitDerived(event, {
    type: "resource",
    at: event.at,
    source: "Elemental Dynamo",
    sourceId: event.sourceId,
    actorType: "player",
    skillName: "Elemental Dynamo",
    kind: "evoker-charges",
    value: state.charges,
    maximum: state.maximumCharges,
    empowered: state.empowered,
  });
}

function modifyRechargeDuration(
  context: SchedulerContext<SchedulerRecord> & { skill?: Skill },
  duration: number,
): number {
  const skill = context.skill;
  if (
    !skill ||
    skill.type !== "Weapon" ||
    String(skill.slot) === "Weapon_1" ||
    !hasTrait(context, "Elemental Balance")
  ) {
    return duration;
  }
  const state = evokerState.from(context);
  if (state.elementalBalanceUntil <= context.state.time + context.epsilon) {
    return duration;
  }
  state.elementalBalanceUntil = 0;
  return duration * 0.34;
}

export const evokerCastRules = Object.freeze({
  availability: {
    id: "elementalist.evoker-availability",
    order: 30,
    handler: availability,
  },
  modifyRechargeDuration,
});

export const evokerSchedulerHooks = Object.freeze({
  onCastStart: {
    id: "elementalist.evoker-start",
    order: 30,
    handler: onCastStart,
  },
  afterCast: {
    id: "elementalist.evoker-after-cast",
    order: 30,
    handler: afterCast,
  },
  onCastComplete: {
    id: "elementalist.evoker-complete",
    order: 30,
    handler: onCastComplete,
  },
  onEventScheduled: {
    id: "elementalist.evoker-charges",
    order: 30,
    handler: onEventScheduled,
  },
});
