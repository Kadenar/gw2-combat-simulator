import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
/**
 * Owns the ordered Core Mesmer effect-controller pipeline used by replacing handlers.
 * Packet emission and stateful effects remain in their focused sibling modules.
 */
import { schedulePhantasmConversions } from '#gw2/professions/mesmer/core/mechanics/illusions/resources.js';
import { createPhantasmEffectController } from '#gw2/professions/mesmer/core/mechanics/illusions/phantasms.js';
import { createSkillDamageController } from '#gw2/professions/mesmer/core/execution/packet-emission.js';
import type {
  MesmerExceptionalProfileOptions,
  MesmerSkillEffectController
} from '#gw2/professions/mesmer/core/execution/effect-types.js';

import type {
  MesmerPhantasmAttackTiming,
  MesmerPhantasmPolicy,
  MesmerQueueResources
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerConditionEffect, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

interface SkillEffectControllerOptions {
  readonly state: MesmerRuntime;
  readonly phantasmTimingFor: (skillId: number) => MesmerPhantasmAttackTiming | undefined;
  readonly phantasmPolicy: () => MesmerPhantasmPolicy;
  readonly queueResources: MesmerQueueResources;
}

/**
 * Composes the focused Mesmer effect controllers used by replacing handlers.
 * Damage packet materialization lives in packet-emission/phantasms, clone attacks
 * live in clone-attacks, and this boundary only preserves execution order.
 */
export function createSkillEffectController({
  state,
  phantasmTimingFor,
  phantasmPolicy,
  queueResources
}: SkillEffectControllerOptions): MesmerSkillEffectController {
  const phantasms = createPhantasmEffectController({ state, phantasmTimingFor, phantasmPolicy, queueResources });
  const damage = createSkillDamageController({ phantasms, state });
  const schedule = (
    skill: MesmerSkill,
    at: number,
    castStart = at,
    {
      clarityConsumed = false,
      phantasmSummonAt = at,
      playerEffectEnd = Infinity,
      delivery = {}
    }: MesmerExceptionalProfileOptions = {}
  ): void => {
    // Only phantasm casts reach this pipeline; ordinary pulses and hit tracking belong to the shared scheduler.
    const phantasmExecutions = phantasms.prepare(skill, castStart, phantasmSummonAt, clarityConsumed, delivery);
    phantasms.scheduleLifecycle(phantasmExecutions);
    const conditions = (skill.effects || []).filter(
      (effect): effect is MesmerConditionEffect => effect.type === 'condition'
    );
    damage.schedule(skill, at, castStart, playerEffectEnd, conditions, phantasmExecutions, delivery);
    // Summon declarations earn resources through their prepared phantasm conversion batches.
    schedulePhantasmConversions(phantasmExecutions, phantasms.queueConversion);
  };

  return { schedule };
}
