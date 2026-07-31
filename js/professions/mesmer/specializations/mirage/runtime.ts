import { EPSILON } from "../../../../platform/engine/clock.js";
import { mesmerRuntimeFor } from "../../core/runtime.js";
import { createMirageActionController } from "./mirage.js";
import {
  MESMER_MIRAGE_AMBUSH_ATTACKS,
  MESMER_MIRAGE_ARISTOCRACY_SKILLS,
  MESMER_MIRAGE_BLIND_SKILLS,
  MESMER_MIRAGE_CONTROL_SKILLS,
  MESMER_MIRAGE_INSTRUMENTS,
  MESMER_MIRAGE_PEITHA_SKILLS,
  MESMER_MIRAGE_SHATTERS,
  MESMER_MIRAGE_TRAIT_DAMAGE,
} from "./mechanics.js";
import type { MesmerSchedulerContext } from "../../types.js";

export function initializeMirageRuntime(
  context: MesmerSchedulerContext,
): void {
  const runtime = mesmerRuntimeFor(context);
  Object.assign(runtime.ambushAttacks, MESMER_MIRAGE_AMBUSH_ATTACKS);
  Object.assign(runtime.shatters, MESMER_MIRAGE_SHATTERS);
  Object.assign(runtime.instruments, MESMER_MIRAGE_INSTRUMENTS);
  Object.assign(runtime.traitDamage, MESMER_MIRAGE_TRAIT_DAMAGE);
  for (const id of MESMER_MIRAGE_CONTROL_SKILLS) {
    runtime.controlSkills.add(id);
  }
  for (const id of MESMER_MIRAGE_BLIND_SKILLS) {
    runtime.blindSkills.add(id);
  }
  for (const id of MESMER_MIRAGE_ARISTOCRACY_SKILLS) {
    runtime.aristocracySkills.add(id);
  }
  for (const id of MESMER_MIRAGE_PEITHA_SKILLS) {
    runtime.peithaSkills.add(id);
  }
  runtime.mirage = createMirageActionController({
    state: context.state,
    config: context.config,
    traits: runtime.traits,
    ambushAttacks: runtime.ambushAttacks,
    cloneAttacks: runtime.cloneAttacks,
    skillsById: runtime.skillsById,
    epsilon: EPSILON,
    addEvent: runtime.addEvent,
    addTraitProc: runtime.addTraitProc,
    addCondition: runtime.addCondition,
    addDamage: runtime.addDamage,
    activePrimaryWeapon: runtime.activePrimaryWeapon,
    queueResources: runtime.resources.queueResources,
    currentResource: runtime.actions.currentResource,
  });
  runtime.resources.setAmbushCreatedClones(
    runtime.mirage.executeCloneAmbushes,
  );
}
