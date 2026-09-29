import { applyMesmerRuntimeManifest, mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { mesmerProfiledShatters } from '#gw2/professions/mesmer/core/profiles.js';
import { resolveBladesong } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesongs.js';
import { MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/definitions.js';
import { VIRTUOSO_SHATTER_PROFILE_IDS } from '#gw2/professions/mesmer/specializations/virtuoso/profiles.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import {
  phantasmalBladesDamage,
  phantasmalBladesPolicy,
  resolveDeadlyBlades,
  resolveInfiniteForgeRefund,
  startInfiniteForge
} from '#gw2/professions/mesmer/specializations/virtuoso/traits/behavior.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

export function initializeVirtuosoRuntime(context: MesmerRuntime): void {
  const runtime = mesmerMechanicsFor(context);
  const phantasmalBlade = phantasmalBladesDamage(context);
  applyMesmerRuntimeManifest(runtime, {
    shatters: mesmerProfiledShatters(context, MESMER_VIRTUOSO_SHATTERS, VIRTUOSO_SHATTER_PROFILE_IDS),
    shatterResolvers: {
      'mesmer.virtuoso.bladesong': resolveBladesong
    },
    shatterResolvedHandlers: [resolveDeadlyBlades, resolveInfiniteForgeRefund],
    traitDamage: {
      'Phantasmal Blade': phantasmalBlade
    },
    phantasmAttackTimings: MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS,
    // Virtuoso owns blade-tick conversion and its optional phantasm trait variations.
    phantasmPolicy: {
      conversionTiming: 'blade-tick',
      ...phantasmalBladesPolicy(context, phantasmalBlade)
    }
  });
  startInfiniteForge(context);
}
