import { timedBuffWindow } from '#gw2/platform/combat/effect-state.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { amalgamCastAvailability } from '#gw2/professions/engineer/specializations/amalgam/mechanics/availability.js';
import { amalgamResolverEventReactions } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form-effects.js';
import { evolvedFormLifecycle } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form.js';
import { observeAmalgamStrainGrant } from '#gw2/professions/engineer/specializations/amalgam/mechanics/strains.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Register scheduled form transitions while previews, eligibility, and hit reactions retain their existing roles. */
export const amalgamHooks = composeRuntimeHooks<EngineerRuntimeState, EngineerSkill>([
  evolvedFormLifecycle,
  {
    /** Hold selected bonuses throughout isolated damage queries without casting Morph or Evolve. */
    prepareDamageState(runtime, _skill, inputs) {
      const state = amalgamState.from(runtime.profession);
      state.willingHostUntil = inputs.willingHost ? Infinity : 0;
      state.evolvedUntil = inputs.evolved ? Infinity : 0;
      state.titanicUntil = inputs.titanic ? Infinity : 0;
      state.plasmaticStateUntil = inputs.plasmaticState ? Infinity : 0;
    },
    // Each damage bonus follows its own refresh deadline.
    observeEffects(runtime) {
      const state = amalgamState.from(runtime.profession);
      return [
        timedBuffWindow('plasmatic-state', 'Plasmatic State', state.plasmaticStateUntil),
        timedBuffWindow('willing-host', 'Willing Host', state.willingHostUntil)
      ];
    },
    // Protocol controls follow the current loadout when players move a protocol between F2 and F4.
    resolveInputControl(context, skill) {
      const index = amalgamState.from(context.profession).selectedMorphSkillIds.indexOf(Number(skill.id));
      const control = (['profession-2', 'profession-3', 'profession-4'] as const)[index];
      return control ? { control } : undefined;
    },
    availability: amalgamCastAvailability,
    reactions: { 'buff.applied': observeAmalgamStrainGrant, 'damage.resolved': amalgamResolverEventReactions.damage }
  }
]);
