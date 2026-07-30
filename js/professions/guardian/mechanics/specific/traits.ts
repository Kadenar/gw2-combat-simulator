/**
 * @fileoverview Implements Guardian trait mechanics that require mutable
 * scheduler state, event observation, or chronological resolver reactions.
 * This includes Luminary light/radiant interactions, symbols, stances, lesser
 * symbols, Resolution triggers, and delayed trait effects.
 */

import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from "../../data/ids.js";
import { SPECIALIZATIONS } from "../../data/guardian-api-metadata.js";
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { isInternalCooldownReady } from "../../../../platform/engine/internal-cooldown.js";
import { isGw2PlayerActorEvent } from "../../../../platform/gw2/event-ownership.js";
import { buildGuardianStrike } from "../events.js";
import type {
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianState,
} from "../../types.js";

type GuardianTraitContext =
  | (GuardianCastContext & {
      readonly traits?: ReadonlySet<SkillId>;
    })
  | (GuardianSchedulerContext & {
      readonly traits?: ReadonlySet<SkillId>;
    })
  | (GuardianResolverContext & {
      readonly traits?: ReadonlySet<SkillId>;
    });

interface GuardianProcEventOptions {
  readonly name: string;
  readonly at: number;
  readonly sourceSkill: string;
  readonly detail?: string;
  readonly icon?: string;
  readonly procType?: string;
  readonly source?: string;
}

interface GuardianResolverBuffOptions {
  readonly at: number;
  readonly sourceId: SkillId;
  readonly skillName: string;
  readonly kind: string;
  readonly duration: number;
  readonly stacks?: number;
  readonly priority?: number;
}

const TRAIT_BY_ID = new Map(
  SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat(),
  ]).map((trait) => [Number(trait.id), trait]),
);

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

const RESOLUTION_SYMBOL_DURATIONS: Readonly<Record<string | number, number>> =
  Object.freeze({
    [GUARDIAN_SKILL_IDS.SYMBOL_OF_RESOLUTION]: 1,
    [GUARDIAN_SKILL_IDS.LUMINOUS_STAFF]: 1,
  });

/**
 * Collects trait selections from every supported build configuration field.
 *
 * @param {GuardianTraitContext} context Scheduler or resolver context.
 * @returns {Array<number|string>} Configured trait identifiers or names.
 */
function configuredTraitValues(
  context: GuardianTraitContext,
): Array<number | string> {
  return [
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ];
}

/**
 * Checks normalized runtime traits and legacy configuration fields for a
 * selected Guardian trait.
 *
 * @param {GuardianTraitContext} context Scheduler or resolver context.
 * @param {SkillId} traitId Trait ID to find.
 * @returns {boolean} Whether the trait is selected.
 */
export function hasGuardianTrait(
  context: GuardianTraitContext,
  traitId: SkillId,
): boolean {
  if (context.traits?.has(traitId) || context.traits?.has(String(traitId)))
    return true;
  const traitName = TRAIT_BY_ID.get(Number(traitId))?.name;
  return configuredTraitValues(context).some(
    (value) =>
      value === traitId ||
      String(value) === String(traitId) ||
      (traitName && value === traitName),
  );
}

/**
 * Resolves a Guardian trait's render icon.
 *
 * @param {SkillId} traitId Trait ID.
 * @returns {string} Trait icon URL, or an empty string when unavailable.
 */
function traitIcon(traitId: SkillId): string {
  return TRAIT_BY_ID.get(Number(traitId))?.icon || "";
}

/**
 * Emits a scheduler-side proc event for a Guardian trait or skill mechanic.
 *
 * @param {GuardianSchedulerContext} context Scheduler context.
 * @param {GuardianProcEventOptions} options Proc event fields.
 * @returns {void}
 */
function emitProc(
  context: GuardianSchedulerContext,
  {
    name,
    at,
    sourceSkill,
    detail = "",
    icon = "",
    procType = "trait",
    source = "Trait",
  }: GuardianProcEventOptions,
): void {
  context.emit({
    type: "proc",
    procType,
    at,
    source,
    sourceId: name,
    actorType: "effect",
    name,
    sourceSkill,
    detail,
    icon,
  });
}

/**
 * Emits a scheduler-side Guardian buff event with consistent ownership.
 *
 * @param {GuardianSchedulerContext} context Scheduler context.
 * @param {GuardianSkill} skill Skill producing the buff.
 * @param {number} at Buff application timestamp.
 * @param {string} kind Internal buff kind.
 * @param {number} duration Duration in seconds.
 * @param {SchedulerRecord} [extra] Additional event fields.
 * @returns {void}
 */
function emitBuff(
  context: GuardianSchedulerContext,
  skill: GuardianSkill,
  at: number,
  kind: string,
  duration: number,
  extra: SchedulerRecord = {},
): void {
  context.emit({
    type: "buff",
    at,
    source: "guardian",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    kind,
    stacks: 1,
    duration,
    ...extra,
  });
}

/**
 * Identifies symbol skills from explicit names, descriptions, or synthetic
 * fallback event names.
 *
 * @param {GuardianSkill | undefined} skill Catalog skill, when available.
 * @param {string} [fallbackName] Event name used for synthetic skills.
 * @returns {boolean} Whether the skill or event represents a symbol.
 */
export function isGuardianSymbolSkill(
  skill: GuardianSkill | undefined,
  fallbackName = "",
): boolean {
  const name = skill?.name || fallbackName;
  const description = String(skill?.description || "");
  return (
    /^Symbol of /.test(name) ||
    /^Lesser Symbol of /.test(name) ||
    name === "Luminous Staff" ||
    /^Symbol\./.test(description) ||
    /\bcreat(?:e|ing) a symbol\b/i.test(description)
  );
}

/**
 * Tests whether Light Aura is active at a timestamp.
 *
 * @param {GuardianState} state Guardian profession state.
 * @param {number} at Simulation timestamp.
 * @param {number} epsilon Floating-point comparison tolerance.
 * @returns {boolean} Whether Light Aura remains active.
 */
function lightAuraActive(
  state: GuardianState,
  at: number,
  epsilon: number,
): boolean {
  return Number(state.lightAuraUntil || 0) > at + epsilon;
}

/**
 * Prunes expired light fields and tests whether one covers the timestamp.
 *
 * @param {GuardianState} state Guardian profession state.
 * @param {number} at Simulation timestamp.
 * @param {number} epsilon Floating-point comparison tolerance.
 * @returns {boolean} Whether a light field is active.
 */
function activeLightField(
  state: GuardianState,
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

/**
 * Adds a timed light field to Guardian scheduler state.
 *
 * @param {GuardianState} state Guardian profession state.
 * @param {number} startsAt Field start timestamp.
 * @param {number} duration Duration in seconds.
 * @returns {void}
 */
function addLightField(
  state: GuardianState,
  startsAt: number,
  duration: number,
): void {
  state.lightFields ||= [];
  state.lightFields.push({
    startsAt,
    endsAt: startsAt + duration,
  });
}

/**
 * Consumes an active Light Aura and emits Sovereign of Light's strike and proc.
 *
 * @param {GuardianCastContext} context Scheduler context.
 * @param {GuardianSkill} skill Skill causing the detonation.
 * @param {number} at Detonation timestamp.
 * @returns {boolean} Whether an active aura was detonated.
 */
function detonateLightAura(
  context: GuardianCastContext,
  skill: GuardianSkill,
  at: number,
): boolean {
  const state = context.state.profession;
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
  emitProc(context, {
    name: "Sovereign of Light",
    at,
    sourceSkill: skill.name,
    detail: "Light aura detonated",
    icon: traitIcon(GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT),
  });
  return true;
}

/**
 * Grants Light Aura, detonating an existing aura first when Sovereign of Light
 * is selected.
 *
 * @param {GuardianCastContext} context Scheduler context.
 * @param {GuardianSkill} skill Skill granting the aura.
 * @param {number} at Aura application timestamp.
 * @returns {void}
 */
function grantLightAura(
  context: GuardianCastContext,
  skill: GuardianSkill,
  at: number,
): void {
  const state = context.state.profession;
  if (
    lightAuraActive(state, at, context.epsilon) &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT)
  ) {
    detonateLightAura(context, skill, at);
  }
  state.lightAuraUntil = at + 4;
}

/**
 * Identifies Luminary actions that detonate Light Aura.
 *
 * @param {GuardianSkill} skill Candidate skill.
 * @returns {boolean} Whether the skill is an aura detonator.
 */
function isLuminaryDetonator(skill: GuardianSkill): boolean {
  if (skill.id === GUARDIAN_SKILL_IDS.GLARING_BURST) return false;
  return Boolean(
    skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE ||
    RADIANT_VIRTUE_IDS.has(skill.id) ||
    skill.radiantForgeSkill === true ||
    (skill.specialization === "Luminary" &&
      skill.categories?.includes("Stance")),
  );
}

/**
 * Identifies Guardian leap finishers used by the light-field model.
 *
 * @param {GuardianSkill} skill Candidate skill.
 * @returns {boolean} Whether the skill is a modeled leap finisher.
 */
function isLightLeap(skill: GuardianSkill): boolean {
  return [
    GUARDIAN_SKILL_IDS.LEAP_OF_FAITH,
    GUARDIAN_SKILL_IDS.DARING_ADVANCE,
    GUARDIAN_SKILL_IDS.GLEAMING_BLADE,
  ].some((skillId) => skillId === skill.id);
}

/**
 * Applies cast-time Light Aura, light-field, finisher, and Justice is Blind
 * interactions for one completed skill.
 *
 * @param {GuardianCastContext} context Scheduler after-cast context.
 * @param {GuardianSkill} skill Completed skill.
 * @returns {void}
 */
function processLightAuraAndFields(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  const state = context.state.profession;
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
  const grantsImmediately =
    skill.id === GUARDIAN_SKILL_IDS.EFFULGENT_STANCE ||
    [
      GUARDIAN_SKILL_IDS.RADIANT_RESOLVE,
      GUARDIAN_SKILL_IDS.RADIANT_RESOLVE_ID_78604,
    ].some((skillId) => skillId === skill.id) ||
    (skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE && sovereign) ||
    (virtueOne &&
      hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND));
  if (grantsImmediately) grantLightAura(context, skill, activationAt);

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

  const finishesLightCombo =
    (isLightLeap(skill) || skill.id === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER) &&
    activeLightField(state, impactAt, context.epsilon);
  if (finishesLightCombo) grantLightAura(context, skill, impactAt);
}

/**
 * Applies stance-specific damage buffs and emits Effulgent Stance lifecycle
 * events.
 *
 * @param {GuardianCastContext} context Scheduler after-cast context.
 * @param {GuardianSkill} skill Completed skill.
 * @returns {void}
 */
function processStanceDamageBuffs(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  if (skill.id === GUARDIAN_SKILL_IDS.PIERCING_STANCE) {
    const state = context.state.profession;
    const at = context.start;
    const wasActive =
      Number(state.piercingStanceUntil || 0) > at + context.epsilon;
    state.piercingStanceUntil = wasActive
      ? state.piercingStanceUntil + 8
      : at + 8;
    emitBuff(
      context,
      skill,
      at,
      "guardian-piercing-stance",
      state.piercingStanceUntil - at,
    );
  } else if (skill.id === GUARDIAN_SKILL_IDS.DARING_ADVANCE) {
    emitBuff(
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

/**
 * Runs all scheduler-side Guardian trait updates after a cast.
 *
 * @param {GuardianCastContext} context Scheduler after-cast context.
 * @param {GuardianSkill} skill Completed skill.
 * @returns {void}
 */
export function updateGuardianTraitCastState(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  processStanceDamageBuffs(context, skill);
  processLightAuraAndFields(context, skill);
}

/**
 * Reduces active Luminary virtue cooldowns by four seconds without moving a
 * cooldown before the triggering timestamp.
 *
 * @param {GuardianSchedulerContext} context Scheduler context.
 * @param {number} at Reduction timestamp.
 * @returns {void}
 */
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

/**
 * Records a newly equipped radiant weapon and applies Radiant Armaments,
 * Empowered Armaments, and Illuminating Inspiration.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Completed radiant weapon skill.
 * @returns {void}
 */
export function handleRadiantWeaponEquipped(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  if (!skill.radiantWeapon || skill.flipParentId != null) return;
  // The initial radiant-weapon attack resolves before that weapon is
  // considered equipped. Apply equip traits immediately after the impact.
  const at = context.effectiveEnd + 0.001;
  const state = context.state.profession;
  const weapon = skill.radiantWeapon;
  state.radiantWeaponsUsed[weapon] = true;

  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS)) {
    emitBuff(context, skill, at, "guardian-radiant-armaments", 10, {
      radiantWeapon: weapon,
    });
    emitProc(context, {
      name: "Radiant Armaments",
      at,
      sourceSkill: skill.name,
      detail:
        weapon === "hammer"
          ? "Radiant hammer: +7% strike damage"
          : `${weapon}: hammer bonus removed`,
      icon: traitIcon(GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS),
    });
  }

  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS)) {
    const wasActive =
      Number(state.empoweredArmamentsUntil || 0) > at + context.epsilon;
    state.empoweredArmamentsUntil = wasActive
      ? Math.min(at + 20, state.empoweredArmamentsUntil + 6)
      : at + 6;
    emitBuff(
      context,
      skill,
      at,
      "guardian-empowered-armaments",
      state.empoweredArmamentsUntil - at,
    );
    emitProc(context, {
      name: "Empowered Armaments",
      at,
      sourceSkill: skill.name,
      detail: wasActive ? "refreshed" : "triggered",
      icon: traitIcon(GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS),
    });
  }

  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION)) {
    reduceVirtueCooldowns(context, at);
    emitProc(context, {
      name: "Illuminating Inspiration",
      at,
      sourceSkill: skill.name,
      detail: "Virtue recharges reduced by 4 seconds",
      icon: traitIcon(GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION),
    });
  }
}

/**
 * Clears radiant-weapon cooldowns associated with an activated virtue.
 *
 * @param {GuardianSchedulerContext} context Scheduler context.
 * @param {string} virtue Normalized virtue name.
 * @returns {boolean} Whether the virtue maps to any radiant weapon skills.
 */
function resetRadiantWeaponCooldowns(
  context: GuardianSchedulerContext,
  virtue: string,
): boolean {
  const ids =
    virtue === "justice"
      ? [RADIANT_WEAPON_SKILLS.hammer]
      : virtue === "resolve"
        ? [RADIANT_WEAPON_SKILLS.staff]
        : virtue === "courage"
          ? [RADIANT_WEAPON_SKILLS.blade, RADIANT_WEAPON_SKILLS.shield]
          : [];
  for (const id of ids) context.state.cooldowns.delete(id);
  return ids.length > 0;
}

/**
 * Emits the five-pulse Lesser Symbol of Blades, registers its light field, and
 * records the Furious Focus proc.
 *
 * @param {GuardianSchedulerContext} context Scheduler context.
 * @param {GuardianSkill} skill Virtue that triggered the symbol.
 * @param {number} at First pulse timestamp.
 * @returns {void}
 */
function emitLesserSymbolOfBlades(
  context: GuardianSchedulerContext,
  skill: GuardianSkill,
  at: number,
): void {
  for (let index = 0; index < 5; index += 1) {
    context.emit(
      buildGuardianStrike({
        at: at + index,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        actorType: "effect",
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        skillName: "Lesser Symbol of Blades",
        name: "Lesser Symbol of Blades",
        coefficient: 0.65,
        skillWeapon: "Unequipped",
        hitIndex: index + 1,
        totalHits: 5,
        isSymbol: true,
        triggeredBy: skill.name,
      }),
    );
  }
  addLightField(context.state.profession, at, 4);
  emitProc(context, {
    name: "Lesser Symbol of Blades",
    at,
    sourceSkill: skill.name,
    detail: "Furious Focus",
    icon: traitIcon(GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS),
  });
}

/**
 * Applies scheduler-side traits triggered by a virtue activation, including
 * Furious Focus, Master-at-Arms, and Luminary weapon empowerment.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Activated virtue skill.
 * @param {string} virtue Normalized virtue name.
 * @returns {void}
 */
export function handleGuardianVirtueTraits(
  context: GuardianCastContext,
  skill: GuardianSkill,
  virtue: string,
): void {
  const at = context.effectiveEnd;
  const state = context.state.profession;
  if (
    virtue === "justice" &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS) &&
    isInternalCooldownReady(at, state.furiousFocusReadyAt)
  ) {
    state.furiousFocusReadyAt = at + 10;
    emitLesserSymbolOfBlades(context, skill, at);
  }
  if (
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS) &&
    resetRadiantWeaponCooldowns(context, virtue)
  ) {
    emitProc(context, {
      name: "Master-at-Arms",
      at,
      sourceSkill: skill.name,
      detail: `${virtue} radiant weapon skills recharged`,
      icon: traitIcon(GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS),
    });
  }
  if (virtue === "justice" && skill.id === GUARDIAN_SKILL_IDS.RADIANT_JUSTICE) {
    state.radiantJusticeArmed = true;
    emitProc(context, {
      name: "Empowered Hammer",
      at,
      sourceSkill: skill.name,
      detail: "Next Dazzling Hammer creates a delayed secondary impact",
      icon: skill.icon,
      procType: "skill",
      source: "Skill",
    });
  }
  if (
    virtue === "courage" &&
    [
      GUARDIAN_SKILL_IDS.RADIANT_COURAGE,
      GUARDIAN_SKILL_IDS.RADIANT_COURAGE_ID_78770,
    ].some((skillId) => skillId === skill.id)
  ) {
    state.radiantCourageSwordArmed = true;
    state.radiantCourageShieldArmed = true;
    emitProc(context, {
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

/**
 * Observes newly scheduled symbol strikes and emits Symbolic Exposure or
 * Resolution events that must share the strike timestamp.
 *
 * @param {GuardianSchedulerContext} context Scheduler event-observer context.
 * @param {GuardianResolverEvent} event Newly scheduled event.
 * @returns {void}
 */
export function observeGuardianScheduledEvent(
  context: GuardianSchedulerContext,
  event: GuardianResolverEvent,
): void {
  if (event.type !== "damage") return;
  const skillId = event.skillId;
  const skill =
    skillId == null ? undefined : context.catalog.skillsById.get(skillId);
  const symbol =
    event.isSymbol || isGuardianSymbolSkill(skill, event.skillName);
  if (!symbol) return;

  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)) {
    context.emit({
      type: "buff",
      at: event.at,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      actorType: "effect",
      skillId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      skillName: "Symbolic Exposure",
      kind: "target-vulnerability",
      stacks: 2,
      duration: 5,
      triggeredBy: event.skillName,
    });
  }

  if (skillId == null) return;
  const resolutionDuration = RESOLUTION_SYMBOL_DURATIONS[skillId] || 0;
  if (resolutionDuration > 0) {
    context.emit({
      type: "buff",
      at: event.at,
      source: "guardian",
      sourceId: skillId,
      actorType: "player",
      skillId,
      skillName: event.skillName,
      kind: "resolution",
      stacks: 1,
      duration: resolutionDuration,
    });
  }
}

/**
 * Returns the chronological Guardian state owned by the resolver.
 *
 * @param {GuardianResolverContext} context Resolver context.
 * @returns {GuardianState} Mutable Guardian resolver state.
 */
function resolverState(context: GuardianResolverContext): GuardianState {
  return context.profession;
}

/**
 * Normalizes the resolver's floating-point comparison tolerance.
 *
 * @param {GuardianResolverContext} context Resolver context.
 * @returns {number} Configured epsilon or the Guardian fallback.
 */
function resolverEpsilon(context: GuardianResolverContext): number {
  return Number(context.epsilon || 0.0001);
}

/**
 * Records a resolver-side Guardian trait proc with its catalog icon.
 *
 * @param {GuardianResolverContext} context Resolver context.
 * @param {SkillId} traitId Triggering trait ID.
 * @param {string} name Display name.
 * @param {number} at Proc timestamp.
 * @param {string | undefined} sourceSkill Triggering skill name.
 * @param {string} detail Human-readable proc detail.
 * @returns {void}
 */
function recordTraitProc(
  context: GuardianResolverContext,
  traitId: SkillId,
  name: string,
  at: number,
  sourceSkill: string | undefined,
  detail: string,
): void {
  context.recordProc(
    "trait",
    name,
    at,
    sourceSkill,
    detail,
    traitIcon(traitId),
  );
}

/**
 * Inserts a Guardian-owned buff into the resolver's ordered event queue.
 *
 * @param {GuardianResolverContext} context Resolver context.
 * @param {GuardianResolverBuffOptions} options Buff event fields.
 * @returns {void}
 */
function queueResolverBuff(
  context: GuardianResolverContext,
  {
    at,
    sourceId,
    skillName,
    kind,
    duration,
    stacks = 1,
    priority = -5,
  }: GuardianResolverBuffOptions,
): void {
  enqueueOrdered(context.queue, {
    type: "buff",
    at,
    priority,
    source: "guardian",
    sourceId,
    actorType: "player",
    skillId: sourceId,
    skillName,
    kind,
    duration,
    stacks,
  });
}

/**
 * Queues all Lesser Symbol of Resolution strike and Resolution pulses.
 *
 * @param {GuardianResolverContext} context Resolver context.
 * @param {number} at First pulse timestamp.
 * @param {string | undefined} sourceSkill Skill that triggered the trait.
 * @returns {void}
 */
function queueLesserSymbolOfResolution(
  context: GuardianResolverContext,
  at: number,
  sourceSkill: string | undefined,
): void {
  for (let index = 0; index < 5; index += 1) {
    const pulseAt = at + index;
    enqueueOrdered(
      context.queue,
      buildGuardianStrike({
        at: pulseAt,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillName: "Lesser Symbol of Resolution",
        name: "Lesser Symbol of Resolution",
        coefficient: 0.5,
        skillWeapon: "Unequipped",
        hitIndex: index + 1,
        totalHits: 5,
        isSymbol: true,
        triggeredBy: sourceSkill,
      }),
    );
    queueResolverBuff(context, {
      at: pulseAt,
      sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
      skillName: "Lesser Symbol of Resolution",
      kind: "resolution",
      duration: 2,
      priority: 5,
    });
  }
}

/**
 * Applies resolver-time Symbolic Avenger and Symbolic Exposure effects for one
 * symbol strike.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Resolved damage event.
 * @returns {void}
 */
function reactToSymbolTraits(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const skill =
    event.skillId == null
      ? undefined
      : context.helpers.skillsById?.get(event.skillId);
  const symbol =
    event.isSymbol || isGuardianSymbolSkill(skill, event.skillName);
  if (!symbol) return;
  const state = resolverState(context);

  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER)) {
    if (event.at >= state.symbolicAvengerUntil - resolverEpsilon(context)) {
      state.symbolicAvengerStacks = 0;
    }
    state.symbolicAvengerStacks = Math.min(
      5,
      Number(state.symbolicAvengerStacks || 0) + 1,
    );
    state.symbolicAvengerUntil = event.at + 15;
    recordTraitProc(
      context,
      GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER,
      "Symbolic Avenger",
      event.at,
      event.skillName,
      `${state.symbolicAvengerStacks}/5 stacks`,
    );
  }

  if (
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)
  ) {
    queueResolverBuff(context, {
      at: event.at,
      sourceId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      skillName: "Symbolic Exposure",
      kind: "target-vulnerability",
      duration: 5,
      stacks: 2,
      priority: 5,
    });
  }
}

/**
 * Adds an Effulgent Stance charge for an eligible Guardian-owned strike during
 * the active collection window.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Resolved damage event.
 * @returns {void}
 */
function reactToEffulgentStrike(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = resolverState(context);
  const guardianOwnedStrike =
    isGw2PlayerActorEvent(event) ||
    (event.source === "guardian" && event.actorType === "effect");
  if (
    !guardianOwnedStrike ||
    !(Number(event.coefficient || 0) > 0) ||
    !(
      event.at <
      Number(state.effulgentActiveUntil || 0) - resolverEpsilon(context)
    )
  )
    return;
  state.effulgentStacks = Math.min(10, Number(state.effulgentStacks || 0) + 1);
}

/**
 * Triggers Lesser Symbol of Resolution after an eligible player strike below
 * the target-health threshold and starts its internal cooldown.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Resolved damage event.
 * @returns {void}
 */
function reactToZealotsResolution(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = resolverState(context);
  const targetHealth = Number(
    context.config.target?.health ?? context.config.targetHP ?? 0,
  );
  const damageDone =
    Number(context.totals?.strike || 0) +
    Number(context.totals?.condition || 0);
  if (
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient || 0) > 0) ||
    !(targetHealth > 0) ||
    !(damageDone > targetHealth * 0.25) ||
    !isInternalCooldownReady(
      event.at,
      Number(state.zealotsResolutionReadyAt || 0),
    ) ||
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION) ||
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION
  )
    return;
  state.zealotsResolutionReadyAt = event.at + 30;
  queueLesserSymbolOfResolution(context, event.at, event.skillName);
  recordTraitProc(
    context,
    GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION,
    "Lesser Symbol of Resolution",
    event.at,
    event.skillName,
    "Zealot's Resolution",
  );
}

/**
 * Runs every Guardian trait reaction attached to resolved damage events.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Resolved damage event.
 * @returns {void}
 */
export function reactToGuardianDamageTraits(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  reactToEffulgentStrike(context, event);
  reactToSymbolTraits(context, event);
  reactToZealotsResolution(context, event);
}

/**
 * Queues one Righteous Instincts Might application and records its proc.
 *
 * @param {GuardianResolverContext} context Resolver context.
 * @param {number} at Application timestamp.
 * @param {string} detail Proc detail.
 * @returns {void}
 */
function queueRighteousMight(
  context: GuardianResolverContext,
  at: number,
  detail: string,
): void {
  queueResolverBuff(context, {
    at,
    sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    skillName: "Righteous Instincts",
    kind: "might",
    duration: 6,
    priority: -5,
  });
  recordTraitProc(
    context,
    GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    "Righteous Instincts",
    at,
    "Resolution",
    detail,
  );
}

/**
 * Tracks Resolution duration and starts Righteous Instincts' immediate and
 * interval-based Might generation.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Resolved buff event.
 * @returns {void}
 */
export function reactToGuardianBuffTraits(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  if (
    String(event.kind || "").toLowerCase() !== "resolution" ||
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS)
  )
    return;
  const state = resolverState(context);
  const duration = Math.max(0, Number(event.duration || 0));
  const wasActive =
    event.at < Number(state.resolutionUntil || 0) - resolverEpsilon(context);
  state.resolutionUntil = wasActive
    ? state.resolutionUntil + duration
    : event.at + duration;
  if (!wasActive) {
    queueRighteousMight(context, event.at, "Resolution applied");
    state.righteousNextMightAt = event.at + 1;
    enqueueOrdered(context.queue, {
      type: "guardian.righteous-instincts-tick",
      at: state.righteousNextMightAt,
      priority: -10,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
      actorType: "effect",
    });
  }
}

/**
 * Processes a scheduled Righteous Instincts interval tick and queues the next
 * tick while Resolution remains active.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Righteous Instincts tick event.
 * @returns {void}
 */
export function handleRighteousInstinctsTick(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = resolverState(context);
  if (
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS) ||
    event.at > Number(state.resolutionUntil || 0) + resolverEpsilon(context) ||
    Math.abs(event.at - Number(state.righteousNextMightAt || 0)) >
      resolverEpsilon(context)
  )
    return;
  queueRighteousMight(context, event.at, "Resolution interval");
  state.righteousNextMightAt = event.at + 1;
  if (
    state.righteousNextMightAt <=
    Number(state.resolutionUntil || 0) + resolverEpsilon(context)
  ) {
    enqueueOrdered(context.queue, {
      ...event,
      at: state.righteousNextMightAt,
    });
  }
}

/**
 * Opens Effulgent Stance's four-second resolver collection window and resets
 * its strike counter.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Effulgent activation event.
 * @returns {void}
 */
export function handleEffulgentActivated(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = resolverState(context);
  state.effulgentActiveUntil = event.at + 4;
  state.effulgentStacks = 0;
}

/**
 * Closes Effulgent Stance's collection window and queues its stack-scaled
 * strike plus the ten-stack daze.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Effulgent detonation event.
 * @returns {void}
 */
export function handleEffulgentDetonate(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = resolverState(context);
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
