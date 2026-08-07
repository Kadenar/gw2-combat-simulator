import {
  applyMesmerRuntimeManifest,
  mesmerRuntimeFor,
} from "../../core/runtime.js";
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
  applyMesmerRuntimeManifest(mesmerRuntimeFor(context), {
    shatters: MESMER_TROUBADOUR_SHATTERS,
    instruments: MESMER_TROUBADOUR_INSTRUMENTS,
    traitDamage: MESMER_TROUBADOUR_TRAIT_DAMAGE,
    controlSkills: MESMER_TROUBADOUR_CONTROL_SKILLS,
    blindSkills: MESMER_TROUBADOUR_BLIND_SKILLS,
    aristocracySkills: MESMER_TROUBADOUR_ARISTOCRACY_SKILLS,
    peithaSkills: MESMER_TROUBADOUR_PEITHA_SKILLS,
  });
}
