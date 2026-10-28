import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/skills/weapons/clone-attacks.js';
import { mesmerSelectedAmbush } from '#gw2/professions/mesmer/specializations/mirage/mechanics/ambush.js';
import { createMirageActionController } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import type { MesmerMirageController } from '#gw2/professions/mesmer/specializations/mirage/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Select the active patch's ambush definitions without installing mutable runtime tables. */
export function mesmerAmbushAttacks(context: MesmerRuntime) {
  return Object.fromEntries(
    Object.entries(MESMER_MIRAGE_AMBUSH_SKILLS).map(([weapon, attack]) => [
      weapon,
      mesmerSelectedAmbush(context, attack.id)
    ])
  );
}

/** Bind the selected Mirage module's operations; lifetimes remain in the specialization slice. */
export function createMirageMechanics(context: MesmerRuntime): MesmerMirageController {
  return createMirageActionController({
    state: context,
    ambushAttacks: mesmerAmbushAttacks(context),
    cloneAttacks: MESMER_CORE_CLONE_ATTACKS,
    activePrimaryWeapon: () => gw2ActivePrimaryWeapon(context.config, context.activeWeaponSet === 1 ? 1 : 2) || ''
  });
}
