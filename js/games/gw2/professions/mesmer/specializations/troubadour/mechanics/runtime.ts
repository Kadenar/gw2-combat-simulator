import { applyMesmerRuntimeManifest, mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_TROUBADOUR_INSTRUMENTS } from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import type { MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';
import {
  TROUBADOUR_INSTRUMENT_PROFILE_IDS,
  mesmerProfiledInstrument
} from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';

export function initializeTroubadourRuntime(context: MesmerSchedulerContext): void {
  const runtime = mesmerRuntimeFor(context);
  applyMesmerRuntimeManifest(runtime, {
    instruments: Object.fromEntries(
      Object.entries(MESMER_TROUBADOUR_INSTRUMENTS).map(([skillId, instrument]) => [
        Number(skillId),
        mesmerProfiledInstrument(context, instrument, TROUBADOUR_INSTRUMENT_PROFILE_IDS[Number(skillId)])
      ])
    )
  });
  // Initialize trait-added instrument ammo after the Troubadour manifest makes slot identities available.
  for (const skill of context.catalog.skills) {
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }
}
