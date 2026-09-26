import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { applyMesmerRuntimeManifest, mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { createMirageActionController } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import type { MesmerMechanics, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import {
  MIRAGE_AMBUSH_PROFILE_IDS,
  mesmerProfiledAmbush
} from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import type { MesmerMirageController } from '#gw2/professions/mesmer/specializations/mirage/types.js';

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
    traits: runtime.traits,
    ambushAttacks: runtime.ambushAttacks,
    cloneAttacks: runtime.cloneAttacks,
    skillsById: runtime.skillsById,
    addEvent: runtime.addEvent,
    addTraitProc: runtime.addTraitProc,
    addCondition: runtime.addCondition,
    addDamage: runtime.addDamage,
    activePrimaryWeapon: runtime.activePrimaryWeapon,
    queueResources: runtime.resources.queueResources,
    balanceProfile: runtime.balanceProfile,
    // Dune Cloak shares the scheduler's base-recharge conversion instead of editing tracked timestamps itself.
    reduceSkillRecharge: context.cooldownController.reduceSkillRecharge
  });
  runtime.mirage = mirage;
  runtime.shatterResolvedHandlers.push((_castContext, resolution) => {
    mirage.handleMirageShatter(resolution.skill, resolution.at, resolution.spent);
  });
  // Infinite Horizon reacts to Mirage-authored clone gains while the generic resource controller stays spec-agnostic.
  runtime.resources.addGainHandler(({ at, cause, createdClones }) => {
    const traitId = Number(cause.traitId);
    const triggersCloneAmbush =
      traitId === TRAIT.DECEPTIVE_EVASION ||
      (traitId === TRAIT.SELF_DECEPTION && cause.sourceSkillId === ID.ILLUSIONARY_AMBUSH);
    // Preserve the inclusive clone-gain deadline, but never treat the zero sentinel as an active cloak.
    const cloneAmbushUntil = mirageState.from(context).cloneAmbushUntil;
    if (
      triggersCloneAmbush &&
      runtime.traits.has(TRAIT.INFINITE_HORIZON) &&
      cloneAmbushUntil > 0 &&
      at <= cloneAmbushUntil
    ) {
      mirage.executeCloneAmbushes(at, createdClones);
    }
  });
  // Riddle of Sand starts armed only for the active Mirage runtime and is re-armed by Mirage shatters.
  mirageState.from(context).riddleOfSandReady =
    runtime.traits.has(TRAIT.RIDDLE_OF_SAND) &&
    Boolean(requireEffect(requireBalanceProfileFromContext(context, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion'));
}
