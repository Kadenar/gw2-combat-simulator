import { EPSILON } from '../../../../platform/engine/core/clock.js';
import { applyMesmerRuntimeManifest, mesmerRuntimeFor } from '../../core/runtime.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { createMirageActionController } from './mirage.js';
import { mirageState } from './state.js';
import {
  MESMER_MIRAGE_AMBUSH_ATTACKS,
  MESMER_MIRAGE_BLIND_SKILLS,
  MESMER_MIRAGE_CONTROL_SKILLS,
  MESMER_MIRAGE_PEITHA_PROJECTILE_DELAYS,
  MESMER_MIRAGE_PEITHA_SKILLS
} from './mechanics.js';
import type { MesmerMirageController, MesmerRuntime, MesmerSchedulerContext } from '../../types.js';
import { MIRAGE_AMBUSH_PROFILE_IDS, mesmerProfiledAmbush } from './profiles.js';

/** Returns the controller installed only by the Mirage runtime. */
export function mirageControllerFor(runtime: MesmerRuntime): MesmerMirageController {
  if (!runtime.mirage) throw new Error('Mirage runtime is not initialized.');
  return runtime.mirage;
}

export function initializeMirageRuntime(context: MesmerSchedulerContext): void {
  const runtime = mesmerRuntimeFor(context);
  applyMesmerRuntimeManifest(runtime, {
    ambushAttacks: Object.fromEntries(
      Object.entries(MESMER_MIRAGE_AMBUSH_ATTACKS).map(([weapon, attack]) => [
        weapon,
        mesmerProfiledAmbush(context, attack, MIRAGE_AMBUSH_PROFILE_IDS[weapon])
      ])
    ),
    controlSkills: MESMER_MIRAGE_CONTROL_SKILLS,
    blindSkills: MESMER_MIRAGE_BLIND_SKILLS,
    peithaSkills: MESMER_MIRAGE_PEITHA_SKILLS,
    peithaProjectileDelays: MESMER_MIRAGE_PEITHA_PROJECTILE_DELAYS
  });
  const mirage = createMirageActionController({
    state: context.state,
    config: context.config,
    traits: runtime.traits,
    ambushAttacks: runtime.ambushAttacks,
    cloneAttacks: runtime.cloneAttacks,
    skillsById: runtime.skillsById,
    epsilon: EPSILON,
    addEvent: runtime.addEvent,
    addTraitProc: runtime.addTraitProc,
    addCondition: runtime.addCondition,
    addDamage: runtime.addDamage,
    activePrimaryWeapon: runtime.activePrimaryWeapon,
    queueResources: runtime.resources.queueResources,
    balanceProfile: runtime.balanceProfile
  });
  runtime.mirage = mirage;
  // Ambush casts replace the shared skill-effect path and stay owned by the active Mirage runtime.
  runtime.skillCompletionHandlers.push((_castContext, skill, at) => {
    if (!skill.ambush) return false;
    mirage.executePlayerAmbush(skill, at, _castContext.start);
    return true;
  });
  runtime.shatterResolvedHandlers.push((_castContext, resolution) => {
    mirage.handleMirageShatter(resolution.skill, resolution.at, resolution.spent);
  });
  // Infinite Horizon reacts to Mirage-authored clone gains while the generic resource controller stays spec-agnostic.
  runtime.resources.addGainHandler(({ at, cause, createdClones }) => {
    const traitId = Number(cause.traitId);
    const triggersCloneAmbush =
      traitId === TRAIT.DECEPTIVE_EVASION ||
      (traitId === TRAIT.SELF_DECEPTION && cause.sourceSkillId === ID.ILLUSIONARY_AMBUSH);
    if (
      triggersCloneAmbush &&
      runtime.traits.has(TRAIT.INFINITE_HORIZON) &&
      mirageState.from(context).cloneAmbushUntil >= at - context.epsilon
    ) {
      mirage.executeCloneAmbushes(at, createdClones);
    }
  });
  // Riddle of Sand starts armed only for the active Mirage runtime and is re-armed by Mirage shatters.
  mirageState.from(context).riddleOfSandReady = runtime.traits.has(TRAIT.RIDDLE_OF_SAND);
}
