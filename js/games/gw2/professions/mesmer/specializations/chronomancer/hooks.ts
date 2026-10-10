import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { completeMesmerShatter } from '#gw2/professions/mesmer/family-mechanics.js';
import { chronomancerBuffPolicies } from '#gw2/professions/mesmer/specializations/chronomancer/effect-state.js';
import { chronomancerAvailability } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/continuum-split.js';
import { createChronomancerMechanics } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/runtime.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** Continuum restores its deliberate checkpoint once; accepted control owns Danger Time. */
export const chronomancerHooks: RuntimeHooks<MesmerRuntimeState, MesmerSkill> = {
  buffPolicies: chronomancerBuffPolicies,
  // Chronomancer strengthens permanent player Alacrity without changing summon recharge or base work.
  playerAlacrityRechargeRate: 1.5,
  // Seed selected ammo pools so Continuum checkpoints include unused skills.
  initialize(context) {
    for (const skill of context.helpers.skills) context.cooldownController.ensureAmmo(skill);
  },
  availability: chronomancerAvailability,
  sideEffectHandlers: {
    // The checkpoint owns its atomic clone spend and publishes the same resolved-shatter notification once.
    'mesmer.chronomancer.begin-continuum'(runtime, context) {
      if (context.kind !== 'cast') return;
      const resolution = createChronomancerMechanics(runtime).beginContinuumSplit(context.skill, runtime.time, {
        activationId: context.cast.id
      });
      completeMesmerShatter(runtime, resolution);
    }
  },
  tasks: {
    'mesmer.continuum-expire'(runtime, data) {
      if (chronomancerState.from(runtime).continuum?.expiresAt !== data) return;
      createChronomancerMechanics(runtime).restoreContinuum(runtime.time, 'split expired');
    },
    'mesmer.chronomancer.restore-continuum'(runtime) {
      createChronomancerMechanics(runtime).restoreContinuum(runtime.time, 'manual shift');
    }
  },
  eventHandlers: { 'mesmer.phantasm-resummoned': OBSERVABLE_EVENT_HANDLER }
};
