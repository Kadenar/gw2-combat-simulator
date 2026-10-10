import { consumeOldestStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { antiquaryResolverEventReactions } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifact-effects.js';
import {
  antiquaryAvailability,
  artifactSlotsUsed,
  storeAntiquaryArtifacts,
  spendAntiquaryInitiative
} from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { antiquaryArtifactActions } from '#gw2/professions/thief/specializations/antiquary/skills/artifact-actions.js';
import { coinInitiative } from '#gw2/professions/thief/specializations/antiquary/skills/double-edge.js';
import { FORGED_SURFER, forgedSurfer } from '#gw2/professions/thief/specializations/antiquary/skills/forged-surfer.js';
import {
  SKRITT_SCUFFLE,
  skrittScufflePilfer
} from '#gw2/professions/thief/specializations/antiquary/skills/skritt-scuffle.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { ThiefConfig, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Antiquary hooks: artifact pilfering and use, Double Edge outcomes, Skritt summons, and artifact-driven traits. */
export const antiquaryHooks: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  /** Seed non-expiring Combat High stacks for an isolated damage occurrence. */
  prepareDamageState(runtime, _skill, inputs) {
    // Artifact use can buff ordinary attacks independently of Combat High.
    antiquaryState.from(runtime).antiquaryDamageUntil = inputs.artifactMomentum ? Infinity : 0;
    if (!hasTrait(runtime, TRAIT.COMBAT_HIGH)) return;
    const stacks = Number(inputs.combatHigh ?? 0);
    const maximum = balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.COMBAT_HIGH), 'maximumStacks');
    if (!Number.isInteger(stacks) || stacks < 0 || stacks > maximum)
      throw new RangeError('Combat High exceeds the selected build maximum.');
    antiquaryState.from(runtime).combatHighExpirations = Array(stacks).fill(Infinity);
  },
  // A pre-steal supplies Swipe's inventory before setup while leaving cooldowns and temporary buffs untouched.
  initialize(runtime) {
    if ((runtime.config as ThiefConfig).initialPreSteal === 1) storeAntiquaryArtifacts(runtime, 'swipe');
  },
  sideEffectHandlers: antiquaryArtifactActions,

  availability: antiquaryAvailability,
  // Only accepted utility casts spend the oldest live Holo-Dancer entry, even when a newer one expires sooner.
  reserveRecharge(runtime, skill, work) {
    if (skill.type !== 'Utility') return work;
    const state = antiquaryState.from(runtime);
    const { expiries, consumed } = consumeOldestStacks(state.holoUtilityCooldownReductionExpirations, 1, runtime.time);
    state.holoUtilityCooldownReductionExpirations = expiries;
    return consumed > 0
      ? work *
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.artifactWindows), 'rechargeMultiplier')
      : work;
  },
  onCastStart(runtime, cast) {
    spendAntiquaryInitiative(runtime, cast);
  },
  onCastCommit(_runtime, cast) {
    artifactSlotsUsed.delete(cast);
    coinInitiative.delete(cast);
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      antiquaryResolverEventReactions.damage(runtime, event);
    }
  },
  tasks: {
    [FORGED_SURFER]: forgedSurfer,
    [SKRITT_SCUFFLE]: skrittScufflePilfer
  }
};
