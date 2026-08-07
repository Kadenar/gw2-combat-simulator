import type { SchedulerState } from "../../../platform/engine/types.js";
import { createIllusionResourceController } from "./illusion-resources.js";
import { createPhantasmEffectController } from "./phantasms.js";
import { createSkillDamageController } from "./skill-damage.js";
import {
  createSkillSpecialEffectController,
} from "./skill-special-effects.js";
import type {
  MesmerActivePrimaryWeapon,
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerConfig,
  MesmerConditionEffect,
  MesmerCurrentResource,
  MesmerExceptionalProfileOptions,
  MesmerInstrument,
  MesmerPhantasmAttackTiming,
  MesmerQueueResources,
  MesmerResourceDefinition,
  MesmerRuntimeState,
  MesmerShatter,
  MesmerSkill,
  MesmerSkillEffectController,
  MesmerTraitDamage,
} from "../types.js";

interface SkillEffectControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly config: MesmerConfig;
  readonly traits: ReadonlySet<number>;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly phantasmAttackTimings: Readonly<
    Record<number, MesmerPhantasmAttackTiming>
  >;
  readonly allSkills: readonly MesmerSkill[];
  readonly epsilon: number;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly currentResource: MesmerCurrentResource;
  readonly markCompounding: (at: number, count: number) => void;
  readonly queueResources: MesmerQueueResources;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly traitDamage: Readonly<Record<string, MesmerTraitDamage>>;
  readonly shatters?: Readonly<Record<number, MesmerShatter>>;
  readonly instruments?: Readonly<Record<number, MesmerInstrument>>;
}

/**
 * Composes the focused Mesmer effect controllers used by replacing handlers.
 * Damage packet materialization lives in skill-damage/phantasms, clone attacks
 * live in clone-attacks, and this boundary only preserves execution order.
 */
export function createSkillEffectController({
  state,
  config,
  traits,
  resourceDefinition,
  phantasmAttackTimings,
  allSkills,
  epsilon,
  activePrimaryWeapon,
  currentResource,
  markCompounding,
  queueResources,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  traitDamage,
  shatters = {},
  instruments = {},
}: SkillEffectControllerOptions): MesmerSkillEffectController {
  const phantasms = createPhantasmEffectController({
    traits,
    resourceDefinition,
    phantasmAttackTimings,
    epsilon,
    markCompounding,
    queueResources,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    traitDamage,
  });
  const illusionResources = createIllusionResourceController({
    resourceDefinition,
    epsilon,
    activePrimaryWeapon,
    currentResource,
    queueResources,
    phantasms,
  });
  const damage = createSkillDamageController({
    state,
    config,
    traits,
    epsilon,
    phantasms,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
  });
  const specialEffects = createSkillSpecialEffectController({
    state,
    traits,
    allSkills,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    traitDamage,
    shatters,
    instruments,
  });

  const schedule = (
    skill: MesmerSkill,
    at: number,
    castStart = at,
    {
      phantasmSummonAt = at,
      playerEffectEnd = Infinity,
    }: MesmerExceptionalProfileOptions = {},
  ): boolean => {
    const clarityConsumed = specialEffects.consumeClarity(skill, castStart);
    const pulseCount = Math.max(1, Math.trunc(Number(skill.pulseCount || 1)));
    const pulseTimes = pulseCount > 1
      ? Array.from(
          { length: pulseCount },
          (_, index) =>
            castStart + ((at - castStart) * (index + 1)) / pulseCount,
        )
      : [];
    const cloneAtMaximum = illusionResources.cloneAtMaximum(skill);
    const phantasmExecutions = phantasms.prepare(
      skill,
      castStart,
      phantasmSummonAt,
      clarityConsumed,
    );
    phantasms.scheduleLifecycle(phantasmExecutions);
    const conditions = cloneAtMaximum
      ? skill.maxCloneEffects || []
      : (skill.effects || []).filter(
          (effect): effect is MesmerConditionEffect =>
            effect.type === "condition"
            && (
              effect.requiredTrait == null
              || traits.has(Number(effect.requiredTrait))
            ),
        );
    const damageResult = damage.schedule(
      skill,
      at,
      castStart,
      playerEffectEnd,
      pulseTimes,
      conditions,
      phantasmExecutions,
    );
    illusionResources.schedule(
      skill,
      at,
      castStart,
      cloneAtMaximum,
      phantasmExecutions,
    );
    specialEffects.apply(skill, at, castStart);
    damage.finish(skill, damageResult);
    return clarityConsumed;
  };

  return { schedule };
}
