import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import { mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-mechanics.js';
import { createMirageActionController } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import {
  MIRAGE_AMBUSH_PROFILE_IDS,
  mesmerProfiledAmbush
} from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import type { MesmerMirageController } from '#gw2/professions/mesmer/specializations/mirage/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Select the active patch's ambush definitions without installing mutable runtime tables. */
export function mesmerAmbushAttacks(context: MesmerRuntime) {
  return Object.fromEntries(
    Object.entries(MESMER_MIRAGE_AMBUSH_SKILLS).map(([weapon, attack]) => [
      weapon,
      mesmerProfiledAmbush(context, attack, MIRAGE_AMBUSH_PROFILE_IDS[weapon])
    ])
  );
}

/** Bind Mirage operations to explicit state; cloak and mirror lifetimes remain in the specialization slice. */
export function createMirageMechanics(context: MesmerRuntime): MesmerMirageController {
  return createMirageActionController({
    state: context,
    config: context.config,
    ambushAttacks: mesmerAmbushAttacks(context),
    cloneAttacks: MESMER_CORE_CLONE_ATTACKS,
    activePrimaryWeapon: () => mesmerActivePrimaryWeapon(context)
  });
}
