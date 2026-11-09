import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { InputControlId } from '#gw2/platform/skills/input-controls.js';
import { runInstantRangerPetCommand } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetCommandBar } from '#gw2/professions/ranger/data/pet-commands.js';
import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import { untamedBuffPolicies } from '#gw2/professions/ranger/specializations/untamed/effect-state.js';
import { untamedUnleashLifecycle } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Compose unleash transitions, buff policies, instant pet commands, preview state, and natural F1/F2/F3 routing. */
export const untamedHooks = composeRuntimeHooks<RangerRuntimeState, RangerSkill>([
  untamedUnleashLifecycle,
  { buffPolicies: untamedBuffPolicies },
  {
    /** Unleashed commands act on the accepting pet and recharge as player casts, bypassing the queued pet lane. */
    modifyEffects(runtime, cast, effects) {
      if (!cast.skill.unleashedPetSkill) return effects;

      runInstantRangerPetCommand(runtime, cast, effects);
      return [];
    },
    /** Hold the selected preview state while evaluating detached damage queries. */
    prepareDamageState(runtime, _skill, inputs) {
      untamedState.from(runtime.profession).ferociousSymbiosisPlayer = {
        stacks: Number(inputs.ferociousSymbiosis ?? 0),
        expiresAt: Infinity
      };
    },
    /** Natural pet commands occupy F1/F2/F3 on the currently selected pet, with the beast skill in F2. */
    resolveInputControl(context, skill) {
      if (!skill.petSkill) return undefined;

      const ids = rangerPetCommandBar(
        rangerPetForState(context.profession.core).skillIds,
        context.helpers.skillsById,
        'Untamed'
      );
      const index = ids.indexOf(skill.id);
      return index >= 0 && index < 3
        ? { control: `profession-${index + 1}` as InputControlId }
        : { control: null, unresolvedReason: 'Pet command is not on the active Untamed bar.' };
    }
  }
]);
