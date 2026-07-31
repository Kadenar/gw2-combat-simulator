import { mesmerRuntimeFor } from "../../core/runtime.js";
import {
  MESMER_VIRTUOSO_ARISTOCRACY_SKILLS,
  MESMER_VIRTUOSO_BLIND_SKILLS,
  MESMER_VIRTUOSO_CONTROL_SKILLS,
  MESMER_VIRTUOSO_INSTRUMENTS,
  MESMER_VIRTUOSO_PEITHA_SKILLS,
  MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS,
  MESMER_VIRTUOSO_SHATTERS,
  MESMER_VIRTUOSO_TRAIT_DAMAGE,
} from "./mechanics.js";
import type { MesmerSchedulerContext } from "../../types.js";

export function initializeVirtuosoRuntime(
  context: MesmerSchedulerContext,
): void {
  const runtime = mesmerRuntimeFor(context);
  Object.assign(runtime.shatters, MESMER_VIRTUOSO_SHATTERS);
  Object.assign(runtime.instruments, MESMER_VIRTUOSO_INSTRUMENTS);
  Object.assign(runtime.traitDamage, MESMER_VIRTUOSO_TRAIT_DAMAGE);
  for (const [id, timing] of Object.entries(
    MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS,
  )) {
    runtime.phantasmAttackTimings[Number(id)] = {
      ...runtime.phantasmAttackTimings[Number(id)],
      ...timing,
    };
  }
  for (const id of MESMER_VIRTUOSO_CONTROL_SKILLS) {
    runtime.controlSkills.add(id);
  }
  for (const id of MESMER_VIRTUOSO_BLIND_SKILLS) {
    runtime.blindSkills.add(id);
  }
  for (const id of MESMER_VIRTUOSO_ARISTOCRACY_SKILLS) {
    runtime.aristocracySkills.add(id);
  }
  for (const id of MESMER_VIRTUOSO_PEITHA_SKILLS) {
    runtime.peithaSkills.add(id);
  }
}
