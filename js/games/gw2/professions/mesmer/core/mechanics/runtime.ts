import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type {
  MesmerRuntime,
  MesmerShatterResolver,
  MesmerShatterResolvedHandler,
  MesmerAmbushAttack,
  MesmerInstrument
} from '#gw2/professions/mesmer/types.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

import type {
  MesmerPhantasmPolicy,
  MesmerPhantasmAttackTiming,
  MesmerTraitDamage
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerConditionApplication } from '#gw2/professions/mesmer/data/types.js';

export function mesmerRuntimeFor(
  context: { readonly mesmerRuntime?: MesmerRuntime } | null | undefined
): MesmerRuntime {
  const runtime = context?.mesmerRuntime;
  if (!runtime) {
    throw new Error('Mesmer scheduler runtime is not initialized.');
  }

  return runtime;
}

/** Resolve a named condition without reconstructing an explicitly removed packet. */
export function mesmerConditionFromProfile(
  context: { readonly mesmerRuntime?: MesmerRuntime } | null | undefined,
  id: number | string,
  name: string
): MesmerConditionApplication | undefined {
  const effect = requireEffect(requireBalanceProfileFromContext(mesmerRuntimeFor(context), id), 'condition', name);
  return effect ? { ...effect, summonKind: undefined, name: effect.condition! } : undefined;
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
}
