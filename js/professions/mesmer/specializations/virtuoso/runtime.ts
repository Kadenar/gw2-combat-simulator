import { MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { applyMesmerRuntimeManifest, mesmerRuntimeFor } from '../../core/runtime.js';
import { resolveDeadlyBlades } from './deadly-blades.js';
import { resolveBladesong } from './bladesongs.js';
import { resolveInfiniteForgeRefund } from './shatter-traits.js';
import {
  MESMER_VIRTUOSO_ARISTOCRACY_SKILLS,
  MESMER_VIRTUOSO_BLIND_SKILLS,
  MESMER_VIRTUOSO_CONTROL_SKILLS,
  MESMER_VIRTUOSO_INSTRUMENTS,
  MESMER_VIRTUOSO_PEITHA_SKILLS,
  MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS,
  MESMER_VIRTUOSO_SHATTERS,
  MESMER_VIRTUOSO_TRAIT_DAMAGE
} from './mechanics.js';
import type { MesmerSchedulerContext } from '../../types.js';
import { VIRTUOSO_BALANCE_PROFILE_IDS as PROFILE, VIRTUOSO_SHATTER_PROFILE_IDS } from './profiles.js';
import { mesmerBalanceValue, mesmerProfiledShatters, mesmerProfiledTraitDamage } from '../../core/profiles.js';

export function initializeVirtuosoRuntime(context: MesmerSchedulerContext): void {
  const runtime = mesmerRuntimeFor(context);
  applyMesmerRuntimeManifest(runtime, {
    shatters: mesmerProfiledShatters(context, MESMER_VIRTUOSO_SHATTERS, VIRTUOSO_SHATTER_PROFILE_IDS),
    shatterResolvers: {
      'mesmer.virtuoso.bladesong': resolveBladesong
    },
    shatterResolvedHandlers: [resolveDeadlyBlades, resolveInfiniteForgeRefund],
    instruments: MESMER_VIRTUOSO_INSTRUMENTS,
    traitDamage: {
      ...MESMER_VIRTUOSO_TRAIT_DAMAGE,
      'Phantasmal Blade': mesmerProfiledTraitDamage(
        context,
        MESMER_VIRTUOSO_TRAIT_DAMAGE['Phantasmal Blade'],
        PROFILE.phantasmalBlades
      )
    },
    phantasmAttackTimings: MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS,
    controlSkills: MESMER_VIRTUOSO_CONTROL_SKILLS,
    blindSkills: MESMER_VIRTUOSO_BLIND_SKILLS,
    aristocracySkills: MESMER_VIRTUOSO_ARISTOCRACY_SKILLS,
    peithaSkills: MESMER_VIRTUOSO_PEITHA_SKILLS
  });

  // Deadly Blades consumes the canonical critical result for each eligible blade strike.
  if (runtime.traits.has(TRAIT.DEADLY_BLADES)) {
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
