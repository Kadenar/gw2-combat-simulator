import { luminaryState } from "./state.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { isGw2PlayerActorEvent } from "../../../../platform/gw2/event-ownership.js";
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from "../../data/ids.js";
import { buildGuardianStrike } from "../../core/events.js";
import {
  emitGuardianBuff,
  emitGuardianProc,
  guardianTraitIcon,
  hasGuardianTrait,
  isGuardianSymbolSkill,
} from "../../core/traits.js";
import { reactToJusticeHitWithOptions } from "../../core/virtues.js";
import type { SkillId } from "../../../../platform/engine/types.js";
import type { Gw2ConditionResolution } from "../../../../platform/gw2/types.js";
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianLuminaryState,
  GuardianVirtue,
} from "../../types.js";

const RADIANT_WEAPON_SKILLS = Object.freeze({
  hammer: GUARDIAN_SKILL_IDS.DAZZLING_HAMMER,
  staff: GUARDIAN_SKILL_IDS.LUMINOUS_STAFF,
  blade: GUARDIAN_SKILL_IDS.GLEAMING_BLADE,
  shield: GUARDIAN_SKILL_IDS.RADIANT_BULWARK,
});
const RADIANT_VIRTUE_IDS: ReadonlySet<SkillId> = new Set([
  GUARDIAN_SKILL_IDS.RADIANT_JUSTICE,
  GUARDIAN_SKILL_IDS.RADIANT_RESOLVE,
  GUARDIAN_SKILL_IDS.RADIANT_RESOLVE_ID_78604,
  GUARDIAN_SKILL_IDS.RADIANT_COURAGE,
  GUARDIAN_SKILL_IDS.RADIANT_COURAGE_ID_78770,
]);

function lightAuraActive(
  state: GuardianLuminaryState,
  at: number,
  epsilon: number,
): boolean {
  return Number(state.lightAuraUntil || 0) > at + epsilon;
}

function activeLightField(
  state: GuardianLuminaryState,
  at: number,
  epsilon: number,
): boolean {
  state.lightFields = (state.lightFields || []).filter(
    (field) => field.endsAt > at + epsilon,
  );
  return state.lightFields.some(
    (field) => field.startsAt <= at + epsilon && field.endsAt > at + epsilon,
  );
}

function addLightField(
  state: GuardianLuminaryState,
  startsAt: number,
  duration: number,
): void {
  state.lightFields ||= [];
  state.lightFields.push({ startsAt, endsAt: startsAt + duration });
}

function detonateLightAura(
  context: GuardianCastContext,
  skill: GuardianSkill,
  at: number,
): boolean {
  const state = luminaryState.from(context);
  if (!lightAuraActive(state, at, context.epsilon)) return false;
  state.lightAuraUntil = 0;
  context.emit(
    buildGuardianStrike({
      at,
      sourceId: GUARDIAN_SKILL_IDS.SOVEREIGN_OF_LIGHT_DAMAGE,
      actorType: "effect",
      skillId: GUARDIAN_SKILL_IDS.SOVEREIGN_OF_LIGHT_DAMAGE,
      skillName: "Sovereign of Light",
      name: "Sovereign of Light",
      coefficient: 1.5,
      skillWeapon: "Unequipped",
      triggeredBy: skill.name,
    }),
  );
  emitGuardianProc(context, {
    name: "Sovereign of Light",
    at,
    sourceSkill: skill.name,
    detail: "Light aura detonated",
    icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT),
  });
  return true;
}

function grantLightAura(
  context: GuardianCastContext,
  skill: GuardianSkill,
  at: number,
): void {
  if (
    lightAuraActive(luminaryState.from(context), at, context.epsilon) &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT)
  ) {
    detonateLightAura(context, skill, at);
  }
  luminaryState.from(context).lightAuraUntil = at + 4;
}

function isLuminaryDetonator(skill: GuardianSkill): boolean {
  if (skill.id === GUARDIAN_SKILL_IDS.GLARING_BURST) return false;
  return Boolean(
    RADIANT_VIRTUE_IDS.has(skill.id) ||
    skill.radiantForgeSkill === true ||
    (skill.specialization === "Luminary" &&
      skill.categories?.includes("Stance")),
  );
}

function isLightLeap(skill: GuardianSkill): boolean {
  return [
    GUARDIAN_SKILL_IDS.LEAP_OF_FAITH,
    GUARDIAN_SKILL_IDS.DARING_ADVANCE,
    GUARDIAN_SKILL_IDS.GLEAMING_BLADE,
  ].some((skillId) => skillId === skill.id);
}

function processLightAuraAndFields(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  const state = luminaryState.from(context);
  const activationAt = context.start;
  const impactAt = context.effectiveEnd;
  const sovereign = hasGuardianTrait(
    context,
    GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT,
  );
  if (sovereign && isLuminaryDetonator(skill)) {
    detonateLightAura(context, skill, activationAt);
  }
  const virtueOne =
    skill.categories?.includes("Virtue") &&
    String(skill.slot) === "Profession_1";
  const enteringRadiantForge =
    skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE;
  const grantsImmediately =
    skill.id === GUARDIAN_SKILL_IDS.EFFULGENT_STANCE ||
    [
      GUARDIAN_SKILL_IDS.RADIANT_RESOLVE,
      GUARDIAN_SKILL_IDS.RADIANT_RESOLVE_ID_78604,
    ].some((skillId) => skillId === skill.id) ||
    (enteringRadiantForge && sovereign) ||
    (virtueOne &&
      hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND));
  if (grantsImmediately) {
    if (enteringRadiantForge) {
      // Entering the forge refreshes the trait-granted aura without consuming
      // an aura that was already active.
      state.lightAuraUntil = activationAt + 4;
    } else {
      grantLightAura(context, skill, activationAt);
    }
  }
  if (
    virtueOne &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND)
  ) {
    context.emit({
      type: "blind",
      at: activationAt,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND,
      actorType: "effect",
      skillId: GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND,
      skillName: "Justice is Blind",
      triggeredBy: skill.name,
      duration: 3,
    });
  }
  if (isGuardianSymbolSkill(skill)) addLightField(state, impactAt, 4);
  if (skill.id === GUARDIAN_SKILL_IDS.DARING_ADVANCE) {
    addLightField(state, impactAt, 5);
  }
  if (
    (isLightLeap(skill) || skill.id === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER) &&
    activeLightField(state, impactAt, context.epsilon)
  ) {
    grantLightAura(context, skill, impactAt);
  }
}

function processStanceDamageBuffs(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  const state = luminaryState.from(context);
  if (skill.id === GUARDIAN_SKILL_IDS.PIERCING_STANCE) {
    const at = context.start;
    const wasActive =
      Number(state.piercingStanceUntil || 0) > at + context.epsilon;
    state.piercingStanceUntil = wasActive
      ? state.piercingStanceUntil + 8
      : at + 8;
    emitGuardianBuff(
      context,
      skill,
      at,
      "guardian-piercing-stance",
      state.piercingStanceUntil - at,
    );
  } else if (skill.id === GUARDIAN_SKILL_IDS.DARING_ADVANCE) {
    emitGuardianBuff(
      context,
      skill,
      context.effectiveEnd + 0.001,
      "guardian-daring-advance",
      8,
    );
  }
  if (skill.id === GUARDIAN_SKILL_IDS.EFFULGENT_STANCE) {
    for (const { type, at } of [
      { type: "guardian.effulgent-activated", at: context.start },
      { type: "guardian.effulgent-detonate", at: context.start + 4 },
    ]) {
      context.emit({
        type,
        at,
        source: "guardian",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
      });
    }
  }
}

function reduceVirtueCooldowns(
  context: GuardianSchedulerContext,
  at: number,
): void {
  for (const skillId of RADIANT_VIRTUE_IDS) {
    const readyAt = Number(context.state.cooldowns.get(skillId) || 0);
    if (!(readyAt > at + context.epsilon)) continue;
    const reduced = Math.max(at, readyAt - 4);
    if (reduced <= at + context.epsilon) {
      context.state.cooldowns.delete(skillId);
    } else {
      context.state.cooldowns.set(skillId, reduced);
    }
  }
}

export function handleRadiantWeaponEquipped(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  if (!skill.radiantWeapon || skill.flipParentId != null) return;
  const at = context.effectiveEnd + 0.001;
  const state = luminaryState.from(context);
  const weapon = skill.radiantWeapon;
  state.radiantWeaponsUsed[weapon] = true;
  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS)) {
    emitGuardianBuff(context, skill, at, "guardian-radiant-armaments", 10, {
      radiantWeapon: weapon,
    });
    emitGuardianProc(context, {
      name: "Radiant Armaments",
      at,
      sourceSkill: skill.name,
      detail:
        weapon === "hammer"
          ? "Radiant hammer: +7% strike damage"
          : `${weapon}: hammer bonus removed`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS),
    });
  }
  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS)) {
    const wasActive =
      Number(state.empoweredArmamentsUntil || 0) > at + context.epsilon;
    state.empoweredArmamentsUntil = wasActive
      ? Math.min(at + 20, state.empoweredArmamentsUntil + 6)
      : at + 6;
    emitGuardianBuff(
      context,
      skill,
      at,
      "guardian-empowered-armaments",
      state.empoweredArmamentsUntil - at,
    );
    emitGuardianProc(context, {
      name: "Empowered Armaments",
      at,
      sourceSkill: skill.name,
      detail: wasActive ? "refreshed" : "triggered",
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS),
    });
  }
  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION)) {
    reduceVirtueCooldowns(context, at);
    emitGuardianProc(context, {
      name: "Illuminating Inspiration",
      at,
      sourceSkill: skill.name,
      detail: "Virtue recharges reduced by 4 seconds",
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION),
    });
  }
}

function virtueFor(skill: GuardianSkill): GuardianVirtue | null {
  if (!RADIANT_VIRTUE_IDS.has(skill.id)) return null;
  const slot = Number(String(skill.slot || "").match(/(\d)$/)?.[1] || 0);
  return ([null, "justice", "resolve", "courage"] as const)[slot] || null;
}

function resetRadiantWeaponCooldowns(
  context: GuardianSchedulerContext,
  virtue: GuardianVirtue,
): boolean {
  const ids =
    virtue === "justice"
      ? [RADIANT_WEAPON_SKILLS.hammer]
      : virtue === "resolve"
        ? [RADIANT_WEAPON_SKILLS.staff]
        : [RADIANT_WEAPON_SKILLS.blade, RADIANT_WEAPON_SKILLS.shield];
  for (const id of ids) context.state.cooldowns.delete(id);
  return ids.length > 0;
}

function handleLuminaryVirtueTraits(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  const virtue = virtueFor(skill);
  if (!virtue) return;
  const at = context.effectiveEnd;
  const state = luminaryState.from(context);
  if (
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS) &&
    resetRadiantWeaponCooldowns(context, virtue)
  ) {
    emitGuardianProc(context, {
      name: "Master-at-Arms",
      at,
      sourceSkill: skill.name,
      detail: `${virtue} radiant weapon skills recharged`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS),
    });
  }
  if (virtue === "justice") {
    state.radiantJusticeArmed = true;
    emitGuardianProc(context, {
      name: "Empowered Hammer",
      at,
      sourceSkill: skill.name,
      detail: "Next Dazzling Hammer creates a delayed secondary impact",
      icon: skill.icon,
      procType: "skill",
      source: "Skill",
    });
  }
  if (virtue === "courage") {
    state.radiantCourageSwordArmed = true;
    state.radiantCourageShieldArmed = true;
    emitGuardianProc(context, {
      name: "Empowered Sword",
      at,
      sourceSkill: skill.name,
      detail: "Next Gleaming Blade deals 50% more damage",
      icon: skill.icon,
      procType: "skill",
      source: "Skill",
    });
  }
}

export function updateLuminaryTraitCastState(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  if (skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE) {
    professionCoreState(context).availableFlips[
      GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE
    ] = Number.POSITIVE_INFINITY;
  }
  processStanceDamageBuffs(context, skill);
  processLightAuraAndFields(context, skill);
  handleLuminaryVirtueTraits(context, skill);
}

export function observeLuminaryScheduledEvent(
  context: GuardianSchedulerContext,
  event: GuardianResolverEvent,
): void {
  if (
    event.type === "damage" &&
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES &&
    Number(event.hitIndex || 0) === 1
  ) {
    addLightField(luminaryState.from(context), event.at, 4);
  }
  if (
    event.type === "damage" &&
    event.skillId === GUARDIAN_SKILL_IDS.LUMINOUS_STAFF
  ) {
    context.emit({
      type: "buff",
      at: event.at,
      source: "guardian",
      sourceId: event.skillId,
      actorType: "player",
      skillId: event.skillId,
      skillName: event.skillName,
      kind: "resolution",
      stacks: 1,
      duration: 1,
    });
  }
}

export function reactToLuminaryJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: {
    readonly hitContext?: object;
    readonly applyCondition?: Gw2ConditionResolution["applyCondition"];
  } = {},
): void {
  reactToJusticeHitWithOptions(context, event, dependencies);
}

export function reactToEffulgentStrike(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = luminaryState.from(context);
  const guardianOwnedStrike =
    isGw2PlayerActorEvent(event) ||
    (event.source === "guardian" && event.actorType === "effect");
  if (
    !guardianOwnedStrike ||
    !(Number(event.coefficient || 0) > 0) ||
    !(
      event.at <
      Number(state.effulgentActiveUntil || 0) -
        Number(context.epsilon || 0.0001)
    )
  ) {
    return;
  }
  state.effulgentStacks = Math.min(10, Number(state.effulgentStacks || 0) + 1);
}

export function handleEffulgentActivated(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  luminaryState.from(context).effulgentActiveUntil = event.at + 4;
  luminaryState.from(context).effulgentStacks = 0;
}

export function handleEffulgentDetonate(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = luminaryState.from(context);
  const stacks = Math.max(0, Math.min(10, Number(state.effulgentStacks || 0)));
  state.effulgentActiveUntil = 0;
  state.effulgentStacks = 0;
  context.recordProc(
    "skill",
    "Effulgent Stance",
    event.at,
    "Effulgent Stance",
    `${stacks}/10 stacks`,
  );
  enqueueOrdered(
    context.queue,
    buildGuardianStrike({
      at: event.at,
      priority: 5,
      sourceId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillName: "Effulgent Stance",
      name: "Effulgent Stance",
      coefficient: 0.5 + stacks * 0.35,
      weaponStrengthProfileId: "nonweapon.unequipped",
      stackCount: stacks,
    }),
  );
  if (stacks === 10) {
    enqueueOrdered(context.queue, {
      type: "control",
      at: event.at,
      priority: 6,
      source: "guardian",
      sourceId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      actorType: "player",
      skillId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillName: "Effulgent Stance",
      controlKind: "daze",
      duration: 2,
    });
  }
}
