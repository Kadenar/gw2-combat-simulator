import { applyMesmerRuntimeManifest, mesmerRuntimeFor } from '../../../core/mechanics/runtime.js';
import {
  MESMER_TROUBADOUR_CONTROL_SKILLS,
  MESMER_TROUBADOUR_INSTRUMENTS,
  MESMER_TROUBADOUR_TRAIT_DAMAGE
} from './definitions.js';
import type { MesmerSchedulerContext } from '../../../types.js';
import {
  TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE,
  TROUBADOUR_INSTRUMENT_PROFILE_IDS,
  mesmerProfiledInstrument
} from '../profiles.js';
import { mesmerBalanceProfile, mesmerBalanceProfileEffect, mesmerProfiledTraitDamage } from '../../../core/profiles.js';

export function initializeTroubadourRuntime(context: MesmerSchedulerContext): void {
  const syncopateProfile = mesmerBalanceProfile(context, PROFILE.syncopate);
  const delayedWave = mesmerBalanceProfileEffect(syncopateProfile, 'strike', 1);
  const runtime = mesmerRuntimeFor(context);
  applyMesmerRuntimeManifest(runtime, {
    instruments: Object.fromEntries(
      Object.entries(MESMER_TROUBADOUR_INSTRUMENTS).map(([skillId, instrument]) => [
        Number(skillId),
        mesmerProfiledInstrument(context, instrument, TROUBADOUR_INSTRUMENT_PROFILE_IDS[Number(skillId)])
      ])
    ),
    traitDamage: {
      ...MESMER_TROUBADOUR_TRAIT_DAMAGE,
      Syncopate: mesmerProfiledTraitDamage(context, MESMER_TROUBADOUR_TRAIT_DAMAGE.Syncopate, PROFILE.syncopate),
      SyncopateDelayedWave: {
        ...MESMER_TROUBADOUR_TRAIT_DAMAGE.SyncopateDelayedWave,
        balanceProfileId: PROFILE.syncopate,
        coefficient: Number(
          delayedWave?.coefficient ?? MESMER_TROUBADOUR_TRAIT_DAMAGE.SyncopateDelayedWave.coefficient
        ),
        hits: Number(delayedWave?.hits ?? MESMER_TROUBADOUR_TRAIT_DAMAGE.SyncopateDelayedWave.hits)
      }
    },
    controlSkills: MESMER_TROUBADOUR_CONTROL_SKILLS
  });
  // Initialize trait-added instrument ammo after the Troubadour manifest makes slot identities available.
  for (const skill of context.catalog.skills) {
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }
}
