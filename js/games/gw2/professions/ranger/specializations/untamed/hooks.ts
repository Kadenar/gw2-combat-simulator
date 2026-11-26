import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { InputControlId } from '#gw2/platform/skills/input-controls.js';
import { runInstantRangerPetCommand } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetCommandSlots, rangerPetSkillCommandable } from '#gw2/professions/ranger/data/pet-commands.js';
import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import { untamedBuffPolicies } from '#gw2/professions/ranger/specializations/untamed/effect-state.js';
import { untamedUnleashLifecycle } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Compose unleash transitions, buff policies, instant pet commands, preview state, and natural F1/F2/F3 routing. */
export const untamedHooks = composeRuntimeHooks<RangerRuntimeState, RangerSkill>([
  untamedUnleashLifecycle,
  {
    buffPolicies: untamedBuffPolicies,
    // The player's damage modifier uses stacks earned by the pet.
    observeEffects(runtime) {
      const grant = untamedState.from(runtime.profession).ferociousSymbiosisPlayer;

      if (!grant.count) return [];

      return [
        timedEffectState(
          'ferocious-symbiosis',
          [{ stacks: grant.count, expiresAt: grant.expiresAt === Infinity ? null : grant.expiresAt }],
          balanceNumber(runtime.helpers, TRAIT.FEROCIOUS_SYMBIOSIS, 'maximumStacks'),
          { name: 'Ferocious Symbiosis' }
        )
      ];
    }
  },
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
        count: Number(inputs.ferociousSymbiosis ?? 0),
        expiresAt: Infinity
      };
    },
    /** Natural pet commands occupy F1/F2/F3 on the currently selected pet, with the beast skill in F2. */
    resolveInputControl(context, skill) {
      if (!skill.petSkill) return undefined;

      const pet = rangerPetForState(context.profession.core);
      const index = rangerPetCommandSlots(pet).indexOf(skill.id);
      return index >= 0 && rangerPetSkillCommandable(pet, skill, 'Untamed')
        ? { control: `profession-${index + 1}` as InputControlId }
        : { control: null, unresolvedReason: 'Pet command is not on the active Untamed bar.' };
    }
  }
]);
