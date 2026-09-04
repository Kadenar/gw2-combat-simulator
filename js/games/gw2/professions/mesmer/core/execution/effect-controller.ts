/**
 * Owns the ordered Core Mesmer effect-controller pipeline used by replacing handlers.
 * Packet emission and stateful effects remain in their focused sibling modules.
 */
import type { SchedulerState } from '#gw2/platform/engine/execution/types.js';
import { createIllusionResourceController } from '#gw2/professions/mesmer/core/mechanics/illusions/resources.js';
import { createPhantasmEffectController } from '#gw2/professions/mesmer/core/mechanics/illusions/phantasms.js';
import { createSkillDamageController } from '#gw2/professions/mesmer/core/execution/packet-emission.js';
import { createSkillSpecialEffectController } from '#gw2/professions/mesmer/core/execution/skill-effects.js';
import type {
  MesmerActivePrimaryWeapon,
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerRuntime,
  MesmerInstrument
} from '#gw2/professions/mesmer/types.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type {
  MesmerExceptionalProfileOptions,
  MesmerSkillEffectController
} from '#gw2/professions/mesmer/core/execution/effect-types.js';

import type {
  MesmerPhantasmAttackTiming,
  MesmerPhantasmPolicy,
  MesmerQueueResources,
  MesmerTraitDamage
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerResourceDefinition } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/state/types.js';
import type { MesmerConditionEffect, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

interface SkillEffectControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly traits: ReadonlySet<number>;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly phantasmAttackTimings: Readonly<Record<number, MesmerPhantasmAttackTiming>>;
  readonly phantasmPolicy: () => MesmerPhantasmPolicy;
  readonly allSkills: readonly MesmerSkill[];
  readonly epsilon: number;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly queueResources: MesmerQueueResources;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly traitDamage: Readonly<Record<string, MesmerTraitDamage>>;
  readonly shatters?: Readonly<Record<number, MesmerShatter>>;
  readonly instruments?: Readonly<Record<number, MesmerInstrument>>;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

/**
 * Composes the focused Mesmer effect controllers used by replacing handlers.
 * Damage packet materialization lives in packet-emission/phantasms, clone attacks
 * live in clone-attacks, and this boundary only preserves execution order.
 */
export function createSkillEffectController({
  state,
  traits,
  resourceDefinition,
  phantasmAttackTimings,
  phantasmPolicy,
  allSkills,
  epsilon,
  activePrimaryWeapon,
  queueResources,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  traitDamage,
  shatters = {},
  instruments = {},
  balanceProfile
}: SkillEffectControllerOptions): MesmerSkillEffectController {
  const phantasms = createPhantasmEffectController({
    traits,
    phantasmAttackTimings,
    phantasmPolicy,
    epsilon,
    queueResources,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    balanceProfile
  });
  const illusionResources = createIllusionResourceController({
    resourceDefinition,
    epsilon,
    activePrimaryWeapon,
    queueResources,
    phantasms
  });
  const damage = createSkillDamageController({
    traits,
    epsilon,
    phantasms,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage
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
    balanceProfile
  });

  const schedule = (
    skill: MesmerSkill,
    at: number,
    castStart = at,
    { clarityConsumed = false, phantasmSummonAt = at, playerEffectEnd = Infinity }: MesmerExceptionalProfileOptions = {}
  ): void => {
    // Only phantasm casts reach this pipeline; ordinary pulses and hit tracking belong to the shared scheduler.
    const phantasmExecutions = phantasms.prepare(skill, castStart, phantasmSummonAt, clarityConsumed);
    phantasms.scheduleLifecycle(phantasmExecutions);
    const conditions = (skill.effects || []).filter(
      (effect): effect is MesmerConditionEffect => effect.type === 'condition'
    );
    const damageResult = damage.schedule(skill, at, castStart, playerEffectEnd, conditions, phantasmExecutions);
    illusionResources.schedule(skill, at, castStart, phantasmExecutions);

    damage.finish(skill, damageResult);
  };

  return {
    consumeClarity: specialEffects.consumeClarity,
    complete: specialEffects.apply,
    schedule,
    scheduleSpecial: specialEffects.schedule,
    scheduleResources: (skill, at, castStart = at) => illusionResources.schedule(skill, at, castStart, [])
  };
}
