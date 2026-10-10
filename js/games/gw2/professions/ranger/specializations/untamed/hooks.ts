import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
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
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  const readyAt = cast.start + balanceProfileNumber(profile, 'recharge');
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
