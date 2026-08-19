import { EPSILON } from '../../../../platform/engine/clock.js';
import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import { applyMesmerRuntimeManifest, mesmerRuntimeFor } from '../../core/runtime.js';
import { createContinuumController } from './continuum.js';
import {
  MESMER_CHRONOMANCER_ARISTOCRACY_SKILLS,
  MESMER_CHRONOMANCER_BLIND_SKILLS,
  MESMER_CHRONOMANCER_CONTROL_SKILLS,
  MESMER_CHRONOMANCER_INSTRUMENTS,
  MESMER_CHRONOMANCER_PEITHA_SKILLS,
  MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS,
  MESMER_CHRONOMANCER_SHATTERS,
  MESMER_CHRONOMANCER_TRAIT_DAMAGE
} from './mechanics.js';
import type { MesmerSchedulerContext } from '../../types.js';
import { CHRONOMANCER_BALANCE_PROFILE_IDS as PROFILE, CHRONOMANCER_SHATTER_PROFILE_IDS } from './profiles.js';
import { mesmerBalanceValue, mesmerProfiledShatters, mesmerProfiledTraitDamage } from '../../core/profiles.js';

const CONTINUUM_UNAFFECTED_COOLDOWN_IDS = new Set<number>([ID.SWAP_WEAPONS]);

export function initializeChronomancerRuntime(context: MesmerSchedulerContext): void {
  const runtime = mesmerRuntimeFor(context);
  applyMesmerRuntimeManifest(runtime, {
    shatters: mesmerProfiledShatters(context, MESMER_CHRONOMANCER_SHATTERS, CHRONOMANCER_SHATTER_PROFILE_IDS),
    instruments: MESMER_CHRONOMANCER_INSTRUMENTS,
    traitDamage: {
      ...MESMER_CHRONOMANCER_TRAIT_DAMAGE,
      'Time Bomb': mesmerProfiledTraitDamage(context, MESMER_CHRONOMANCER_TRAIT_DAMAGE['Time Bomb'], PROFILE.timeBomb)
    },
    phantasmAttackTimings: MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS,
    controlSkills: MESMER_CHRONOMANCER_CONTROL_SKILLS,
    blindSkills: MESMER_CHRONOMANCER_BLIND_SKILLS,
    aristocracySkills: MESMER_CHRONOMANCER_ARISTOCRACY_SKILLS,
    peithaSkills: MESMER_CHRONOMANCER_PEITHA_SKILLS
  });
  for (const skill of context.catalog.skills) {
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }

  runtime.continuum = createContinuumController({
    state: context.state,
    unaffectedCooldownIds: CONTINUUM_UNAFFECTED_COOLDOWN_IDS,
    epsilon: EPSILON,
    skillsById: runtime.skillsById,
    refreshAmmo: context.cooldownController.refreshAmmo,
    consumeResources: runtime.actions.consumeResources,
    triggerShatterTraits: runtime.actions.triggerShatterTraits,
    addEvent: runtime.addEvent,
    durationPerSource: mesmerBalanceValue(context, PROFILE.continuumSplit, 'durationPerTier', 1.5),
    scheduleExpiry: (at) =>
      context.tasks.schedule({
        type: 'mesmer.continuum-expire',
        at,
        priority: -30,
        ownerId: 'mesmer.continuum',
        payload: { expiresAt: at }
      })
  });
}
