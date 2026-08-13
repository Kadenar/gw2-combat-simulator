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
import type { ElementalistAttunement } from "../../core/state.js";
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
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Familiar's Prowess",
      sourceId: skill.id,
      actorType: "player",
      skillName: "Familiar's Prowess",
      kind: "familiar's-prowess",
      stacks: 1,
      duration: 5,
    });
  }
  const familiarElement = FAMILIAR_ELEMENTS[skill.name];
  if (familiarElement && hasTrait(context, "Familiar's Blessing")) {
    context.emit({
      type: "buff",
      at,
      source: "Familiar's Blessing",
      sourceId: skill.id,
      actorType: "player",
      skillName: "Familiar's Blessing",
      kind:
        familiarElement === "Fire" || familiarElement === "Air"
          ? "quickness"
          : "alacrity",
      stacks: 1,
      duration:
        familiarElement === "Fire" || familiarElement === "Air" ? 1.75 : 4,
    });
  }
  if (skill.name === "Lightning Blitz") {
    const enchantmentCount = hasTrait(context, "Galvanic Enchantment") ? 3 : 1;
    const packets = context.events
      .filter(
        (event) =>
          event.activationId === context.reservationId &&
          event.type === "damage" &&
          event.skillId === skill.id,
      )
      .slice(0, enchantmentCount);
    for (const packet of packets) {
      context.emit({
        type: "damage",
        at: packet.at,
        source: "Electric Enchantment",
        sourceId: skill.id,
        actorType: "effect",
        skillName: "Electric Enchantment",
        coefficient: 0.4,
        skillWeapon: "Unequipped",
      });
      context.emit({
        type: "condition",
        at: packet.at,
        source: "Electric Enchantment",
        sourceId: skill.id,
        actorType: "effect",
        skillName: "Electric Enchantment",
        condition: "Burning",
        stacks: 1,
        duration: 1.5,
      });
    }
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
  } else if (skill.name === "Toad's Fortitude" && state.element === "Earth") {
    context.emit({
      type: "buff",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      kind: "resistance",
      stacks: 1,
      duration: 4,
    });
  } else if (skill.name === "Fox's Fury") {
    const might = context.buffStacks("might", context.start);
    const tier = might >= 20 ? 2 : might >= 10 ? 1 : 0;
    const coefficients = [1.5, 2.25, 3];
    const burningStacks = [1, 2, 3];
    const burningDurations = [3, 5, 7];
    context.emit({
      type: "damage",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      skillId: skill.id,
      coefficient: coefficients[tier],
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
      stacks: burningStacks[tier],
      duration: burningDurations[tier],
    });
    context.emit({
      type: "buff",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      kind: "might",
      stacks: 8 + (state.element === "Fire" ? 3 : 0),
      duration: 10,
    });
    context.emit({
      type: "buff",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      kind: "fury",
      stacks: 1,
      duration: 10,
    });
  }
}

function onEventScheduled(
  context: SchedulerContext<SchedulerRecord>,
  event: SimulationEvent,
): void {
  if (
    event.type === "damage" &&
    event.actorType === "player" &&
    Number(event.coefficient) > 0
  ) {
    const state = evokerState.from(context);
    if (state.electricEnchantmentStacks > 0) {
      state.electricEnchantmentStacks -= 1;
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
    }
  }
  if (event.type === "elementalist.evasive-arcana") {
    const attunement = String(event.attunement || "");
    if (attunement === "Air") return;
    const state = evokerState.from(context);
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
  if (event.type !== "elementalist.attunement") return;
  const state = evokerState.from(context);
  if (event.to !== state.element) return;
  if (hasTrait(context, "Elemental Balance")) {
    state.elementalBalanceProgress += 1;
    if (state.elementalBalanceProgress >= 2) {
      state.elementalBalanceProgress -= 2;
      state.elementalBalanceUntil = event.at + 5;
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
