import { mesmerRuntimeFor } from "../../core/runtime.js";
import {
  MESMER_TROUBADOUR_ARISTOCRACY_SKILLS,
  MESMER_TROUBADOUR_BLIND_SKILLS,
  MESMER_TROUBADOUR_CONTROL_SKILLS,
  MESMER_TROUBADOUR_INSTRUMENTS,
  MESMER_TROUBADOUR_PEITHA_SKILLS,
  MESMER_TROUBADOUR_SHATTERS,
  MESMER_TROUBADOUR_TRAIT_DAMAGE,
} from "./mechanics.js";
import type { MesmerSchedulerContext } from "../../types.js";

export function initializeTroubadourRuntime(
  context: MesmerSchedulerContext,
): void {
  const runtime = mesmerRuntimeFor(context);
  Object.assign(runtime.shatters, MESMER_TROUBADOUR_SHATTERS);
  Object.assign(runtime.instruments, MESMER_TROUBADOUR_INSTRUMENTS);
  Object.assign(runtime.traitDamage, MESMER_TROUBADOUR_TRAIT_DAMAGE);
  for (const id of MESMER_TROUBADOUR_CONTROL_SKILLS) {
    runtime.controlSkills.add(id);
  }
  for (const id of MESMER_TROUBADOUR_BLIND_SKILLS) {
    runtime.blindSkills.add(id);
  }
  for (const id of MESMER_TROUBADOUR_ARISTOCRACY_SKILLS) {
    runtime.aristocracySkills.add(id);
  }
  for (const id of MESMER_TROUBADOUR_PEITHA_SKILLS) {
    runtime.peithaSkills.add(id);
  }
}
