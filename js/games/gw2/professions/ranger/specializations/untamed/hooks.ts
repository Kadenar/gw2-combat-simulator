import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { InputControlId } from '#gw2/platform/skills/input-controls.js';
import { emitRangerPetSkill, restartRangerPetAutoattack } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetCommandBar } from '#gw2/professions/ranger/data/pet-commands.js';
import { untamedBuffPolicies } from '#gw2/professions/ranger/specializations/untamed/effect-state.js';
import { untamedUnleashLifecycle } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Register the unleash lifecycle while pet command routing and execution stay with the specialization assembly. */
export const untamedHooks = composeRuntimeHooks<RangerRuntimeState, RangerSkill>([
  untamedUnleashLifecycle,
  { buffPolicies: untamedBuffPolicies },
  {
    /** Hold the selected preview state while evaluating detached damage queries. */
    prepareDamageState(runtime, _skill, inputs) {
      untamedState.from(runtime).ferociousSymbiosisPlayer = {
        stacks: Number(inputs.ferociousSymbiosis ?? 0),
        expiresAt: Infinity
      };
    },
    // Each Unleashed F1/F2/F3 command preempts the active pet's autonomous swing.
    onCastStart(runtime, cast) {
      if (cast.skill.unleashedPetSkill) restartRangerPetAutoattack(runtime);
    },
    // Delayed strikes belong to the pet accepting the command, even if a swap precedes impact.
    modifyEffects(runtime, cast, effects) {
      if (!cast.skill.unleashedPetSkill) return effects;

      emitRangerPetSkill(runtime, { ...cast.skill, effects }, cast.start, cast.fullEnd, cast.id, cast);
      return [];
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
