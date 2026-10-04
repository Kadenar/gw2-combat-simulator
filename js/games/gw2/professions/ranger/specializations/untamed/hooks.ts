import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import {
  grantAmbush,
  untamedCastAvailability
} from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { reactToUntamedDamage } from '#gw2/professions/ranger/specializations/untamed/traits/behavior.js';
import type { RangerSkill, RangerRuntime, RangerRuntimeState } from '#gw2/professions/ranger/types.js';

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

export const untamedHooks: Partial<RuntimeProfession<RangerRuntimeState, RangerSkill>> = {
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
  reactions: { 'damage.resolved': reactToUntamedDamage }
};
