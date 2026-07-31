import { EPSILON } from "../../../../platform/engine/clock.js";
import { MESMER_SKILL_IDS as ID } from "../../data/ids.js";
import { mesmerRuntimeFor } from "../../core/runtime.js";
import { createContinuumController } from "./continuum.js";
import {
  MESMER_CHRONOMANCER_ARISTOCRACY_SKILLS,
  MESMER_CHRONOMANCER_BLIND_SKILLS,
  MESMER_CHRONOMANCER_CONTROL_SKILLS,
  MESMER_CHRONOMANCER_INSTRUMENTS,
  MESMER_CHRONOMANCER_PEITHA_SKILLS,
  MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS,
  MESMER_CHRONOMANCER_SHATTERS,
  MESMER_CHRONOMANCER_TRAIT_DAMAGE,
} from "./mechanics.js";
import type { MesmerSchedulerContext } from "../../types.js";

const CONTINUUM_UNAFFECTED_COOLDOWN_IDS = new Set<number>([ID.SWAP_WEAPONS]);

export function initializeChronomancerRuntime(
  context: MesmerSchedulerContext,
): void {
  const runtime = mesmerRuntimeFor(context);
  Object.assign(runtime.shatters, MESMER_CHRONOMANCER_SHATTERS);
  Object.assign(runtime.instruments, MESMER_CHRONOMANCER_INSTRUMENTS);
  Object.assign(runtime.traitDamage, MESMER_CHRONOMANCER_TRAIT_DAMAGE);
  for (const [id, timing] of Object.entries(
    MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS,
  )) {
    runtime.phantasmAttackTimings[Number(id)] = {
      ...runtime.phantasmAttackTimings[Number(id)],
      ...timing,
    };
  }
  for (const id of MESMER_CHRONOMANCER_CONTROL_SKILLS) {
    runtime.controlSkills.add(id);
  }
  for (const id of MESMER_CHRONOMANCER_BLIND_SKILLS) {
    runtime.blindSkills.add(id);
  }
  for (const id of MESMER_CHRONOMANCER_ARISTOCRACY_SKILLS) {
    runtime.aristocracySkills.add(id);
  }
  for (const id of MESMER_CHRONOMANCER_PEITHA_SKILLS) {
    runtime.peithaSkills.add(id);
  }
  for (const skill of context.catalog.skills) {
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }
  runtime.continuum = createContinuumController({
    state: context.state,
    unaffectedCooldownIds: CONTINUUM_UNAFFECTED_COOLDOWN_IDS,
    epsilon: EPSILON,
    skillsById: runtime.skillsById,
    refreshAmmo: context.cooldownController.refreshAmmo,
    consumeResources: runtime.actions.consumeResources,
    triggerShatterTraits: runtime.actions.triggerShatterTraits,
    addEvent: runtime.addEvent,
    scheduleExpiry: (at) =>
      context.tasks.schedule({
        type: "mesmer.continuum-expire",
        at,
        priority: -30,
        ownerId: "mesmer.continuum",
        payload: { expiresAt: at },
      }),
  });
}
