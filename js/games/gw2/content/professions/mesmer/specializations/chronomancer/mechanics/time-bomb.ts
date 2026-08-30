import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../../../data/ids.js';
import { mesmerRuntimeFor } from '../../../core/mechanics/runtime.js';
import { chronomancerState } from '../state.js';
import type { MesmerCastContext, MesmerSkill } from '../../../types.js';

/** Arms Time Bomb only after a completed Time Sink and keeps its delayed explosion attributed to that cast. */
export function completeChronomancerTimeBomb(context: MesmerCastContext, skill: MesmerSkill): void {
  if (skill.id !== ID.TIME_SINK || context.effectiveEnd < context.fullEnd - context.epsilon) return;

  const runtime = mesmerRuntimeFor(context);
  const state = chronomancerState.from(context);
  const at = context.fullEnd;
  if (!runtime.traits.has(TRAIT.TIME_BOMB) || at < state.timeBombUntil - context.epsilon) return;

  const timeBomb = runtime.traitDamage['Time Bomb'];
  const duration = Number(timeBomb.duration || 0);
  state.timeBombUntil = at + duration;
  const previousEmission = runtime.activeEmission;
  runtime.activeEmission = {
    skill,
    effectiveEnd: Infinity,
    activationId: context.reservationId
  };
  try {
    runtime.addEvent({
      type: 'buff',
      at,
      kind: 'time-bomb',
      stacks: 1,
      duration: duration + context.epsilon,
      sourceSkill: skill.name
    });
    runtime.addDamage(
      {
        id: 'Time Bomb',
        name: 'Time Bomb',
        weapon: 'Utility',
        blade: false
      },
      state.timeBombUntil,
      {
        coefficient: timeBomb.coefficient,
        hits: timeBomb.hits,
        source: 'Player',
        weapon: 'utility'
      }
    );
    runtime.addTraitProc('Time Bomb', at, skill.name, `explodes after ${duration}s`);
  } finally {
    runtime.activeEmission = previousEmission;
  }
}
