import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { amalgamCastAvailability } from '#gw2/professions/engineer/specializations/amalgam/mechanics/availability.js';
import { amalgamResolverEventReactions } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form-effects.js';
import { evolvedFormLifecycle } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Register scheduled form transitions while previews, eligibility, and hit reactions retain their existing roles. */
export const amalgamHooks: RuntimeHooks<EngineerRuntimeState, EngineerSkill> = {
  ...evolvedFormLifecycle,
  /** Hold selected bonuses throughout isolated damage queries without casting Morph or Evolve. */
  prepareDamageState(runtime, _skill, inputs) {
    const state = amalgamState.from(runtime);
    state.willingHostUntil = inputs.willingHost ? Infinity : 0;
    state.evolvedUntil = inputs.evolved ? Infinity : 0;
    state.titanicUntil = inputs.titanic ? Infinity : 0;
    state.plasmaticStateUntil = inputs.plasmaticState ? Infinity : 0;
  },
  availability: amalgamCastAvailability,
  reactions: { 'damage.resolved': amalgamResolverEventReactions.damage }
};
