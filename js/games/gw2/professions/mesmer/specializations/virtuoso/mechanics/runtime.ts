import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { applyMesmerRuntimeManifest, mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { resolveDeadlyBlades } from '#gw2/professions/mesmer/specializations/virtuoso/traits/deadly-blades.js';
import { resolveBladesong } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesongs.js';
import { resolveInfiniteForgeRefund } from '#gw2/professions/mesmer/specializations/virtuoso/traits/shatters.js';
import {
  MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS,
  MESMER_VIRTUOSO_SHATTERS,
  MESMER_VIRTUOSO_TRAIT_DAMAGE
} from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/definitions.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import {
  VIRTUOSO_BALANCE_PROFILE_IDS as PROFILE,
  VIRTUOSO_SHATTER_PROFILE_IDS
} from '#gw2/professions/mesmer/specializations/virtuoso/profiles.js';
import { mesmerProfiledShatters, mesmerProfiledTraitDamage } from '#gw2/professions/mesmer/core/profiles.js';

export function initializeVirtuosoRuntime(context: MesmerRuntime): void {
  const runtime = mesmerMechanicsFor(context);
  const phantasmalBlade = mesmerProfiledTraitDamage(
    context,
    MESMER_VIRTUOSO_TRAIT_DAMAGE['Phantasmal Blade'],
    PROFILE.phantasmalBlades
  );
  applyMesmerRuntimeManifest(runtime, {
    shatters: mesmerProfiledShatters(context, MESMER_VIRTUOSO_SHATTERS, VIRTUOSO_SHATTER_PROFILE_IDS),
    shatterResolvers: {
      'mesmer.virtuoso.bladesong': resolveBladesong
    },
    shatterResolvedHandlers: [resolveDeadlyBlades, resolveInfiniteForgeRefund],
    traitDamage: {
      ...MESMER_VIRTUOSO_TRAIT_DAMAGE,
      'Phantasmal Blade': phantasmalBlade
    },
    phantasmAttackTimings: MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS,
    // Virtuoso owns blade-tick conversion and its optional phantasm trait variations.
    phantasmPolicy: {
      conversionTiming: 'blade-tick',
      ...(runtime.traits.has(TRAIT.PHANTASMAL_BLADES) && phantasmalBlade.type === 'strike'
        ? {
            bonusStrike: {
              name: 'Phantasmal Blade',
              traitName: 'Phantasmal Blades',
              damage: phantasmalBlade
            }
          }
        : {})
    }
  });

  // The native queue owns passive generation; each pulse schedules only its successor.
  if (runtime.traits.has(TRAIT.INFINITE_FORGE)) {
    const interval = balanceProfileNumber(
      requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE),
      'pulseInterval'
    );
    if (interval > 0) context.schedule('mesmer.infinite-forge', interval, undefined, undefined, -20);
  }
}
