import { applyMesmerRuntimeManifest, mesmerRuntimeFor } from '../../core/runtime.js';
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
import { mesmerProfiledShatters, mesmerProfiledTraitDamage } from '../../core/profiles.js';

export function initializeVirtuosoRuntime(context: MesmerSchedulerContext): void {
  applyMesmerRuntimeManifest(mesmerRuntimeFor(context), {
    shatters: mesmerProfiledShatters(context, MESMER_VIRTUOSO_SHATTERS, VIRTUOSO_SHATTER_PROFILE_IDS),
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
}
