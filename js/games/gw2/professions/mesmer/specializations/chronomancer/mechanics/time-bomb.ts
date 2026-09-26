import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

/** Arms Time Bomb only after a completed Time Sink and keeps its delayed explosion attributed to that cast. */
export function completeChronomancerTimeBomb(context: MesmerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as MesmerSkill;
  if (skill.id !== ID.TIME_SINK || castWasInterrupted(cast)) return;

  const runtime = mesmerMechanicsFor(context);
  const state = chronomancerState.from(context);
  const at = cast.fullEnd;
  if (!runtime.traits.has(TRAIT.TIME_BOMB) || at < state.timeBombUntil) return;

  const timeBomb = runtime.traitDamage['Time Bomb'];
  // The removed explosion cannot arm a timer or emit a synthetic hit.
  if (timeBomb.type !== 'strike') return;
  const duration = Number(timeBomb.duration || 0);
  // This is the delayed explosion timer; rearming is allowed exactly when it detonates.
  state.timeBombUntil = canonicalTime(at + duration);
  const previousEmission = runtime.activeEmission;
  runtime.activeEmission = {
    skill,
    effectiveEnd: Infinity,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  };
  try {
    runtime.addEvent({
      type: 'buff',
      at,
      kind: 'time-bomb',
      stacks: 1,
      duration,
      expiresAt: state.timeBombUntil,
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
        ...timeBomb,
        summonKind: undefined,
        source: 'Player',
        weapon: 'utility'
      }
    );
    runtime.addTraitProc('Time Bomb', at, skill.name, `explodes after ${duration}s`);
  } finally {
    runtime.activeEmission = previousEmission;
  }
}
