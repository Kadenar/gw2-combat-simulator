import { rangerPetCommandBar } from '#gw2/professions/ranger/data/pet-commands.js';
import type { InputControlId } from '#gw2/platform/skills/input-controls.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { emitRangerPetSkill, restartRangerPetAutoattack } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import {
  grantAmbush,
  untamedCastAvailability
} from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Both toggles share fixed recharge; only an eligible transfer to Ranger claims a new ambush. */
function unleash(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>, rangerUnleashed: boolean): void {
  untamedState.from(runtime).rangerUnleashed = rangerUnleashed;
  const readyAt = cast.start + balanceNumberFromContext(runtime, PROFILE.resources, 'recharge');
  runtime.cooldownController.setReadyAt(ID.UNLEASH_RANGER, readyAt);
  runtime.cooldownController.setReadyAt(ID.UNLEASH_PET, readyAt);

  if (rangerUnleashed && runtime.procs.claim(PROFILE.resources, 'ranger.untamed.unleashedPower', runtime.time))
    grantAmbush(runtime);
}

export const untamedHooks: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  /** Hold the selected preview state while evaluating detached damage queries. */
  prepareDamageState(runtime, _skill, inputs) {
    untamedState.from(runtime).ferociousSymbiosisPlayer = {
      stacks: Number(inputs.ferociousSymbiosis ?? 0),
      expiresAt: Infinity
    };
  },
  availability: untamedCastAvailability,
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

    const ids = rangerPetCommandBar(context.profession.core.activePetSkillIds, context.helpers.skillsById, 'Untamed');
    const index = ids.indexOf(skill.id);
    return index >= 0 && index < 3
      ? { control: `profession-${index + 1}` as InputControlId }
      : { control: null, unresolvedReason: 'Pet command is not on the active Untamed bar.' };
  },
  sideEffectHandlers: {
    'ranger.ambush-consume'(runtime) {
      untamedState.from(runtime).ambushReadyUntil = 0;
    },
    'ranger.unleash-ranger'(runtime, context) {
      if (context.kind === 'cast') unleash(runtime, context.cast, true);
    },
    'ranger.unleash-pet'(runtime, context) {
      if (context.kind === 'cast') unleash(runtime, context.cast, false);
    }
  },
  reactions: {
    'damage.resolved'(context, event) {
      if (
        // Only hitting strikes (coefficient > 0) advance trait state; misses and barrier hits are excluded.
        !(Number(event.coefficient) > 0) ||
        (!isPlayerStrike(event) && !isPetStrike(event))
      ) {
        return;
      }

      context.fireTrigger(untamedStrike, { event });
    }
  }
};

/** Accepted player and pet strikes advance cross-buffs before player-only ambush rewards. */
export const untamedStrike = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>('ranger.untamed-strike', [
  TRAIT.FEROCIOUS_SYMBIOSIS,
  TRAIT.LET_LOOSE
]);
