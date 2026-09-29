import { applyMesmerRuntimeManifest, mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { createMirageActionController } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import {
  MIRAGE_AMBUSH_PROFILE_IDS,
  mesmerProfiledAmbush
} from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import { initializeMirageTraits } from '#gw2/professions/mesmer/specializations/mirage/traits/behavior.js';
import type { MesmerMirageController } from '#gw2/professions/mesmer/specializations/mirage/types.js';
import type { MesmerMechanics, MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Returns the controller installed only by the Mirage runtime. */
export function mirageControllerFor(runtime: MesmerMechanics): MesmerMirageController {
  if (!runtime.mirage) throw new Error('Mirage runtime is not initialized.');
  return runtime.mirage;
}

export function initializeMirageRuntime(context: MesmerRuntime): void {
  const runtime = mesmerMechanicsFor(context);
  applyMesmerRuntimeManifest(runtime, {
    ambushAttacks: Object.fromEntries(
      Object.entries(MESMER_MIRAGE_AMBUSH_SKILLS).map(([weapon, attack]) => [
        weapon,
        mesmerProfiledAmbush(context, attack, MIRAGE_AMBUSH_PROFILE_IDS[weapon])
      ])
    )
  });
  const mirage = createMirageActionController({
    state: context,
    config: context.config,
    ambushAttacks: runtime.ambushAttacks,
    cloneAttacks: runtime.cloneAttacks,
    addEvent: runtime.addEvent,
    addCondition: runtime.addCondition,
    addDamage: runtime.addDamage,
    activePrimaryWeapon: runtime.activePrimaryWeapon
  });
  runtime.mirage = mirage;
  runtime.shatterResolvedHandlers.push((_castContext, resolution) => {
    mirage.handleMirageShatter(resolution.skill, resolution.at, resolution.spent);
  });
  initializeMirageTraits(context);
}
