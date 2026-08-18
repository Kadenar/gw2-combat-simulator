import { EPSILON } from '../../../../platform/engine/clock.js';
import { applyMesmerRuntimeManifest, mesmerRuntimeFor } from '../../core/runtime.js';
import { createMirageActionController } from './mirage.js';
import {
  MESMER_MIRAGE_AMBUSH_ATTACKS,
  MESMER_MIRAGE_ARISTOCRACY_SKILLS,
  MESMER_MIRAGE_BLIND_SKILLS,
  MESMER_MIRAGE_CONTROL_SKILLS,
  MESMER_MIRAGE_INSTRUMENTS,
  MESMER_MIRAGE_PEITHA_SKILLS,
  MESMER_MIRAGE_SHATTERS,
  MESMER_MIRAGE_TRAIT_DAMAGE
} from './mechanics.js';
import type { MesmerSchedulerContext } from '../../types.js';
import { MIRAGE_AMBUSH_PROFILE_IDS } from './profiles.js';
import { mesmerProfiledAmbush } from '../../core/profiles.js';

export function initializeMirageRuntime(context: MesmerSchedulerContext): void {
  const runtime = mesmerRuntimeFor(context);
  applyMesmerRuntimeManifest(runtime, {
    ambushAttacks: Object.fromEntries(
      Object.entries(MESMER_MIRAGE_AMBUSH_ATTACKS).map(([weapon, attack]) => [
        weapon,
        mesmerProfiledAmbush(context, attack, MIRAGE_AMBUSH_PROFILE_IDS[weapon])
      ])
    ),
    shatters: MESMER_MIRAGE_SHATTERS,
    instruments: MESMER_MIRAGE_INSTRUMENTS,
    traitDamage: MESMER_MIRAGE_TRAIT_DAMAGE,
    controlSkills: MESMER_MIRAGE_CONTROL_SKILLS,
    blindSkills: MESMER_MIRAGE_BLIND_SKILLS,
    aristocracySkills: MESMER_MIRAGE_ARISTOCRACY_SKILLS,
    peithaSkills: MESMER_MIRAGE_PEITHA_SKILLS
  });
  runtime.mirage = createMirageActionController({
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
    currentResource: runtime.actions.currentResource,
    balanceProfile: runtime.balanceProfile
  });
  runtime.resources.setAmbushCreatedClones(runtime.mirage.executeCloneAmbushes);
}
