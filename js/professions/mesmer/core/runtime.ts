import { MESMER_SKILL_IDS as ID } from "../data/ids.js";
import type { MesmerRuntime } from "../types.js";

export const MESMER_FLIP_PARENT_BY_CHILD_ID: Readonly<Record<number, number>> =
  Object.freeze({
    [ID.COUNTERSPELL]: ID.ILLUSIONARY_COUNTER,
    [ID.POWER_SPIKE]: ID.MANTRA_OF_PAIN,
    [ID.DIMENSIONAL_APERTURE]: ID.SINGULARITY_SHOT,
    [ID.ABSTRACTION]: ID.INSPIRING_IMAGERY,
    [ID.INTO_THE_VOID]: ID.TEMPORAL_CURTAIN,
    [ID.COUNTER_BLADE]: ID.ILLUSIONARY_RIPOSTE,
    [ID.SWAP]: ID.ILLUSIONARY_LEAP,
  });

export const MESMER_FLIP_CHILD_BY_PARENT_ID: Readonly<Record<number, number>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(MESMER_FLIP_PARENT_BY_CHILD_ID).map(
        ([childId, parentId]): [number, number] => [parentId, Number(childId)],
      ),
    ),
  );

export function mesmerRuntimeFor(
  context: { readonly mesmerRuntime?: MesmerRuntime } | null | undefined,
): MesmerRuntime {
  const runtime = context?.mesmerRuntime;
  if (!runtime) {
    throw new Error("Mesmer scheduler runtime is not initialized.");
  }
  return runtime;
}
