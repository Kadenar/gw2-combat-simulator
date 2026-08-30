import { MESMER_TRAIT_IDS as TRAIT } from '../../../data/ids.js';
import { applyMesmerRuntimeManifest, mesmerRuntimeFor } from '../../../core/mechanics/runtime.js';
import { resolveDeadlyBlades } from '../traits/deadly-blades.js';
import { resolveBladesong } from './bladesongs.js';
import { resolveInfiniteForgeRefund } from '../traits/shatters.js';
import {
  MESMER_VIRTUOSO_ARISTOCRACY_SKILLS,
  MESMER_VIRTUOSO_CONTROL_SKILLS,
  MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS,
  MESMER_VIRTUOSO_SHATTERS,
  MESMER_VIRTUOSO_TRAIT_DAMAGE
} from './definitions.js';
import type { MesmerSchedulerContext } from '../../../types.js';
import { VIRTUOSO_BALANCE_PROFILE_IDS as PROFILE, VIRTUOSO_SHATTER_PROFILE_IDS } from '../profiles.js';
import { mesmerBalanceValue, mesmerProfiledShatters, mesmerProfiledTraitDamage } from '../../../core/profiles.js';

export function initializeVirtuosoRuntime(context: MesmerSchedulerContext): void {
  const runtime = mesmerRuntimeFor(context);
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
      ...(runtime.traits.has(TRAIT.PHANTASMAL_BLADES)
        ? {
            bonusStrike: {
              name: 'Phantasmal Blade',
              traitName: 'Phantasmal Blades',
              damage: phantasmalBlade
            }
          }
        : {})
    },
    controlSkills: MESMER_VIRTUOSO_CONTROL_SKILLS,
    aristocracySkills: MESMER_VIRTUOSO_ARISTOCRACY_SKILLS
  });

  // Virtuoso critical traits consume canonical per-hit critical facts in specialization-owned observers.
  if (runtime.traits.has(TRAIT.DEADLY_BLADES) || runtime.traits.has(TRAIT.JAGGED_MIND)) {
    context.schedulerPolicy.requireCriticalFacts?.();
  }

  // Infinite Forge's recurring blade generation starts only for the active Virtuoso specialization.
  if (runtime.traits.has(TRAIT.INFINITE_FORGE)) {
    context.tasks.schedule({
      type: 'mesmer.infinite-forge',
      at: mesmerBalanceValue(context, TRAIT.INFINITE_FORGE, 'pulseInterval', 3),
      priority: -20,
      ownerId: 'mesmer.infinite-forge',
      payload: {}
    });
  }
}
