import { EPSILON } from '../../../../../../../../kernel/core/clock.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../../../data/ids.js';
import { applyMesmerRuntimeManifest, mesmerRuntimeFor } from '../../../core/mechanics/runtime.js';
import { createContinuumController } from './continuum-split.js';
import { resolveChronomancerShatterBoons, resolveIllusionaryReversion } from '../traits/shatters.js';
import {
  MESMER_CHRONOMANCER_CONTROL_SKILLS,
  MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS,
  MESMER_CHRONOMANCER_SHATTERS,
  MESMER_CHRONOMANCER_TRAIT_DAMAGE
} from './definitions.js';
import type { MesmerContinuumController, MesmerRuntime, MesmerSchedulerContext } from '../../../types.js';
import { CHRONOMANCER_BALANCE_PROFILE_IDS as PROFILE, CHRONOMANCER_SHATTER_PROFILE_IDS } from '../profiles.js';
import { mesmerBalanceValue, mesmerProfiledShatters, mesmerProfiledTraitDamage } from '../../../core/profiles.js';

const CONTINUUM_UNAFFECTED_COOLDOWN_IDS = new Set<number>([ID.SWAP_WEAPONS]);

/** Returns the controller installed only by the Chronomancer runtime. */
export function chronomancerControllerFor(runtime: MesmerRuntime): MesmerContinuumController {
  if (!runtime.continuum) throw new Error('Chronomancer runtime is not initialized.');
  return runtime.continuum;
}

export function initializeChronomancerRuntime(context: MesmerSchedulerContext): void {
  const runtime = mesmerRuntimeFor(context);
  applyMesmerRuntimeManifest(runtime, {
    shatters: mesmerProfiledShatters(context, MESMER_CHRONOMANCER_SHATTERS, CHRONOMANCER_SHATTER_PROFILE_IDS),
    shatterResolvedHandlers: [resolveChronomancerShatterBoons, resolveIllusionaryReversion],
    traitDamage: {
      ...MESMER_CHRONOMANCER_TRAIT_DAMAGE,
      'Time Bomb': mesmerProfiledTraitDamage(context, MESMER_CHRONOMANCER_TRAIT_DAMAGE['Time Bomb'], PROFILE.timeBomb)
    },
    phantasmAttackTimings: MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS,
    phantasmPolicy: runtime.traits.has(TRAIT.CHRONOPHANTASMA)
      ? {
          repeat: {
            label: 'Chronophantasma',
            traitName: 'Chronophantasma',
            damageMultiplier: mesmerBalanceValue(context, PROFILE.chronophantasma, 'damageMultiplier', 1.05)
          }
        }
      : undefined,
    controlSkills: MESMER_CHRONOMANCER_CONTROL_SKILLS
  });
  for (const skill of context.catalog.skills) {
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }

  const continuum = createContinuumController({
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
  runtime.continuum = continuum;
  // Continuum Split replaces the ordinary shatter path while still publishing a resolved shatter contract.
  runtime.skillCompletionHandlers.push((castContext, skill, at) =>
    skill.id === ID.CONTINUUM_SPLIT
      ? continuum.beginContinuumSplit(skill, at, {
          sourceSkill: skill.name,
          rotationIndex: castContext.commandIndex
        })
      : false
  );
}
