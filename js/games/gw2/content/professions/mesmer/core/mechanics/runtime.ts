import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type {
  MesmerAmbushAttack,
  MesmerInstrument,
  MesmerPhantasmPolicy,
  MesmerPhantasmAttackTiming,
  MesmerRuntime,
  MesmerShatter,
  MesmerShatterResolver,
  MesmerShatterResolvedHandler,
  MesmerTraitDamage
} from '#gw2/content/professions/mesmer/types.js';

export const MESMER_FLIP_PARENT_BY_CHILD_ID: Readonly<Record<number, number>> = Object.freeze({
  [ID.COUNTERSPELL]: ID.ILLUSIONARY_COUNTER,
  [ID.POWER_SPIKE]: ID.MANTRA_OF_PAIN,
  [ID.DIMENSIONAL_APERTURE]: ID.SINGULARITY_SHOT,
  [ID.ABSTRACTION]: ID.INSPIRING_IMAGERY,
  [ID.INTO_THE_VOID]: ID.TEMPORAL_CURTAIN,
  [ID.COUNTER_BLADE]: ID.ILLUSIONARY_RIPOSTE,
  [ID.SWAP]: ID.ILLUSIONARY_LEAP
});

export const MESMER_FLIP_CHILD_BY_PARENT_ID: Readonly<Record<number, number>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_FLIP_PARENT_BY_CHILD_ID).map(([childId, parentId]): [number, number] => [
      parentId,
      Number(childId)
    ])
  )
);

export function mesmerRuntimeFor(
  context: { readonly mesmerRuntime?: MesmerRuntime } | null | undefined
): MesmerRuntime {
  const runtime = context?.mesmerRuntime;
  if (!runtime) {
    throw new Error('Mesmer scheduler runtime is not initialized.');
  }

  return runtime;
}

/**
 * The specialization-owned mechanics each runtime folds into the shared Mesmer
 * runtime on initialization. Every field is optional so a specialization only
 * supplies the tables it actually defines.
 */
export interface MesmerRuntimeManifest {
  readonly shatters?: Readonly<Record<number, MesmerShatter>>;
  readonly shatterResolvers?: Readonly<Record<string, MesmerShatterResolver>>;
  readonly shatterResolvedHandlers?: readonly MesmerShatterResolvedHandler[];
  readonly instruments?: Readonly<Record<number, MesmerInstrument>>;
  readonly traitDamage?: Readonly<Record<string, MesmerTraitDamage>>;
  readonly ambushAttacks?: Readonly<Record<string, MesmerAmbushAttack>>;
  readonly phantasmAttackTimings?: Readonly<Record<number, Partial<MesmerPhantasmAttackTiming>>>;
  readonly phantasmPolicy?: Partial<MesmerPhantasmPolicy>;
  readonly controlSkills?: Iterable<number>;
  readonly blindSkills?: Iterable<number>;
  readonly aristocracySkills?: Iterable<number>;
  readonly peithaSkills?: Iterable<number>;
  readonly peithaProjectileDelays?: Readonly<Record<number, number>>;
}

/** Folds a specialization's mechanics manifest into the shared runtime. */
export function applyMesmerRuntimeManifest(runtime: MesmerRuntime, manifest: MesmerRuntimeManifest): void {
  if (manifest.ambushAttacks) {
    Object.assign(runtime.ambushAttacks, manifest.ambushAttacks);
  }

  if (manifest.shatters) Object.assign(runtime.shatters, manifest.shatters);
  if (manifest.shatterResolvers) Object.assign(runtime.shatterResolvers, manifest.shatterResolvers);
  if (manifest.shatterResolvedHandlers) {
    runtime.shatterResolvedHandlers.push(...manifest.shatterResolvedHandlers);
  }

  if (manifest.instruments) {
    Object.assign(runtime.instruments, manifest.instruments);
  }

  if (manifest.traitDamage) {
    Object.assign(runtime.traitDamage, manifest.traitDamage);
  }

  if (manifest.phantasmAttackTimings) {
    for (const [id, timing] of Object.entries(manifest.phantasmAttackTimings)) {
      runtime.phantasmAttackTimings[Number(id)] = {
        ...runtime.phantasmAttackTimings[Number(id)],
        ...timing
      };
    }
  }

  if (manifest.phantasmPolicy) {
    runtime.phantasmPolicy = {
      ...runtime.phantasmPolicy,
      ...manifest.phantasmPolicy,
      spawnModifiers: {
        ...runtime.phantasmPolicy.spawnModifiers,
        ...manifest.phantasmPolicy.spawnModifiers
      }
    };
  }

  for (const id of manifest.controlSkills || []) runtime.controlSkills.add(id);
  for (const id of manifest.blindSkills || []) runtime.blindSkills.add(id);
  for (const id of manifest.aristocracySkills || []) {
    runtime.aristocracySkills.add(id);
  }

  for (const id of manifest.peithaSkills || []) runtime.peithaSkills.add(id);
  if (manifest.peithaProjectileDelays) {
    Object.assign(runtime.peithaProjectileDelays, manifest.peithaProjectileDelays);
  }
}
